import express, { type Request, type Response } from "express";
import * as fs from "node:fs/promises";
import * as path from "node:path";

import {
  createAligoTemplate,
  deleteAligoTemplate,
  getAligoConfigStatus,
  getAligoHistoryDetail,
  getAligoQuota,
  listAligoHistory,
  listAligoProfiles,
  listAligoTemplates,
  requestAligoTemplateReview,
  sendAligo,
  sendAligoSms,
  sendAligoTest,
  verifyAligoAccess,
} from "../aligo";
import { renderAligoPreview } from "../aligo";
import { recordMessage } from "../crmLocalDb";
import {
  evaluateForEnforcement,
  type ContactPolicyEnforcementResult,
  type EnforcementSeverity,
} from "../contactPolicy";
import { log, obsEvents } from "../obs";

const ALIGO_RECEIVER_WHITELIST = ["01039348641"];
const SEND_LOG_PATH = path.resolve(__dirname, "..", "..", "logs", "aligo-sends.jsonl");

async function appendSendLog(entry: Record<string, unknown>) {
  try {
    const dir = path.dirname(SEND_LOG_PATH);
    await fs.mkdir(dir, { recursive: true });
    await fs.appendFile(SEND_LOG_PATH, `${JSON.stringify(entry)}\n`, "utf8");
  } catch {
    console.error("[aligo] send log write failed");
  }
}

export const createAligoRouter = () => {
  const router = express.Router();

  router.get("/api/aligo/status", (_req: Request, res: Response) => {
    res.json({
      ok: true,
      config: getAligoConfigStatus(),
    });
  });

  router.get("/api/aligo/health", async (_req: Request, res: Response) => {
    const config = getAligoConfigStatus();
    const probe = await verifyAligoAccess();

    if (!probe.ok) {
      res.status(probe.reason === "missing_credentials" ? 400 : probe.status ?? 502).json({
        ok: false,
        config,
        probe,
      });
      return;
    }

    res.json({
      ok: true,
      config,
      probe,
    });
  });

  router.get("/api/aligo/profiles", async (_req: Request, res: Response) => {
    const result = await listAligoProfiles();
    res.status(result.ok ? 200 : result.status ?? 502).json(result);
  });

  router.get("/api/aligo/templates", async (_req: Request, res: Response) => {
    const result = await listAligoTemplates();
    res.status(result.ok ? 200 : result.status ?? 502).json(result);
  });

  router.get("/api/aligo/quota", async (_req: Request, res: Response) => {
    const result = await getAligoQuota();
    res.status(result.ok ? 200 : result.status ?? 502).json(result);
  });

  router.get("/api/aligo/whitelist", (_req: Request, res: Response) => {
    res.json(ALIGO_RECEIVER_WHITELIST);
  });

  router.get("/api/aligo/history", async (req: Request, res: Response) => {
    const page = parsePositiveInteger(req.query.page, 1);
    const limit = parsePositiveInteger(req.query.limit, 50);
    const startDate = parseDateToken(req.query.startDate);
    const endDate = parseDateToken(req.query.endDate);

    if (page === null || limit === null) {
      res.status(400).json({
        ok: false,
        error: "page and limit must be positive integers",
      });
      return;
    }

    if (startDate === null || endDate === null) {
      res.status(400).json({
        ok: false,
        error: "startDate and endDate must be YYYYMMDD or YYYY-MM-DD",
      });
      return;
    }

    const result = await listAligoHistory({
      page,
      limit,
      startDate: startDate ?? undefined,
      endDate: endDate ?? undefined,
    });
    res.status(result.ok ? 200 : result.status ?? 502).json(result);
  });

  router.get("/api/aligo/history/:mid", async (req: Request, res: Response) => {
    const page = parsePositiveInteger(req.query.page, 1);
    const limit = parsePositiveInteger(req.query.limit, 50);
    const mid = String(req.params.mid ?? "").trim();

    if (!mid) {
      res.status(400).json({
        ok: false,
        error: "mid is required",
      });
      return;
    }

    if (page === null || limit === null) {
      res.status(400).json({
        ok: false,
        error: "page and limit must be positive integers",
      });
      return;
    }

    const result = await getAligoHistoryDetail({
      mid,
      page,
      limit,
    });
    res.status(result.ok ? 200 : result.status ?? 502).json(result);
  });

  router.post("/api/aligo/send", async (req: Request, res: Response) => {
    const { tplCode, receiver, recvname, subject, message, emtitle, button, testMode, consentStatus, adminOverride: reqAdminOverride, daysSinceLastPurchase, source: sendSource, memberCode, experimentKey, groupId, templateType } =
      (req.body ?? {}) as Record<string, unknown>;

    const normalizedTplCode = readRequiredString(tplCode);
    const normalizedReceiver = normalizePhoneNumber(receiver);
    const normalizedSubject = readRequiredString(subject);
    const normalizedMessage = readRequiredString(message);
    const normalizedRecvname = readOptionalString(recvname);
    const normalizedEmtitle = readOptionalString(emtitle);
    const normalizedTestMode = resolveAligoTestMode(testMode);
    const timestamp = new Date().toISOString();

    console.log("[aligo/send attempt]", {
      timestamp,
      receiver: normalizedReceiver ?? "",
      tplCode: normalizedTplCode ?? "",
      testMode: normalizedTestMode,
    });

    const requiredErrors = [
      ...(!normalizedTplCode ? [{ field: "tplCode", code: "required", message: "tplCode 필요" }] : []),
      ...(!normalizedReceiver ? [{ field: "receiver", code: "required", message: "receiver 필요" }] : []),
      ...(!normalizedSubject ? [{ field: "subject", code: "required", message: "subject 필요" }] : []),
      ...(!normalizedMessage ? [{ field: "message", code: "required", message: "message 필요" }] : []),
    ];
    if (requiredErrors.length > 0) {
      res.status(400).json({
        ok: false,
        error: requiredErrors[0].message,
        errors: requiredErrors,
      });
      return;
    }
    const tplCodeForSend = normalizedTplCode!;
    const receiverForSend = normalizedReceiver!;
    const subjectForSend = normalizedSubject!;
    const messageForSend = normalizedMessage!;

    const isAdminOverride = reqAdminOverride === true || reqAdminOverride === "true";
    const policy = evaluateForEnforcement({
      channel: "alimtalk",
      receiver: receiverForSend,
      memberCode: typeof memberCode === "string" ? memberCode : null,
      templateCode: tplCodeForSend,
      templateType: typeof templateType === "string" ? templateType : null,
      body: messageForSend,
      source: typeof sendSource === "string" ? sendSource : null,
      groupId: typeof groupId === "string" ? groupId : null,
      adminOverride: isAdminOverride,
    });
    if (sendPolicyBlockedResponse(res, policy, {
      channel: "alimtalk",
      receiver: receiverForSend,
      templateCode: tplCodeForSend,
      groupId: typeof groupId === "string" ? groupId : null,
      source: typeof sendSource === "string" ? sendSource : null,
    })) {
      return;
    }

    if (!ALIGO_RECEIVER_WHITELIST.includes(receiverForSend) && !isAdminOverride) {
      res.status(403).json({
        ok: false,
        message: "수신자가 허용 목록에 없습니다. 관리자 강제 발송(adminOverride)을 사용하세요.",
      });
      return;
    }

    const result = await sendAligo({
      tplCode: tplCodeForSend,
      receiver: receiverForSend,
      recvname: normalizedRecvname ?? undefined,
      subject: subjectForSend,
      message: messageForSend,
      emtitle: normalizedEmtitle ?? undefined,
      button,
      testMode: normalizedTestMode,
    });

    const body = (result.ok ? result.body : result.body) as Record<string, unknown> | undefined;
    await appendSendLog({
      timestamp,
      channel: "alimtalk",
      receiver: receiverForSend,
      recvname: normalizedRecvname,
      tplCode: tplCodeForSend,
      subject: subjectForSend,
      testMode: normalizedTestMode,
      consentStatus: consentStatus ?? null,
      adminOverride: reqAdminOverride === true || reqAdminOverride === "true",
      daysSinceLastPurchase: typeof daysSinceLastPurchase === "number" ? daysSinceLastPurchase : null,
      memberCode: typeof memberCode === "string" && memberCode ? memberCode : null,
      source: sendSource ?? null,
      ok: result.ok,
      mid: (body?.info as Record<string, unknown>)?.mid ?? null,
      errorCode: body?.code ?? null,
      errorMessage: result.ok ? null : (body?.message ?? null),
    });

    // crm_message_log에 기록 (전화번호 기준 — 실험 배정 키와 일치)
    if (receiverForSend) {
      try {
        recordMessage({
          experiment_key: typeof experimentKey === "string" && experimentKey ? experimentKey : undefined,
          customer_key: receiverForSend,
          channel: "alimtalk",
          provider_status: result.ok ? "success" : "fail",
          template_code: tplCodeForSend,
        });
      } catch { /* 로그 실패는 무시 */ }
    }

    // SMS fallback: 알림톡 실패 시 자동 SMS 발송
    const { fallbackSms, fallbackMessage } = (req.body ?? {}) as Record<string, unknown>;
    if (!result.ok && fallbackSms && messageForSend) {
      const smsMsg = readOptionalString(fallbackMessage) ?? messageForSend;
      const fallbackPolicy = evaluateForEnforcement({
        channel: "sms",
        receiver: receiverForSend,
        memberCode: typeof memberCode === "string" ? memberCode : null,
        templateCode: tplCodeForSend,
        templateType: typeof templateType === "string" ? templateType : null,
        body: smsMsg,
        source: typeof sendSource === "string" ? sendSource : null,
        groupId: typeof groupId === "string" ? groupId : null,
        adminOverride: isAdminOverride,
      });
      if (sendPolicyBlockedResponse(res, fallbackPolicy, {
        channel: "sms_fallback",
        receiver: receiverForSend,
        templateCode: tplCodeForSend,
        groupId: typeof groupId === "string" ? groupId : null,
        source: typeof sendSource === "string" ? sendSource : null,
      })) {
        return;
      }
      const smsResult = await sendAligoSms({
        receiver: receiverForSend,
        message: smsMsg,
        testMode: normalizedTestMode,
      });
      const smsBody = (smsResult.ok ? smsResult.body : smsResult.body) as Record<string, unknown> | undefined;
      await appendSendLog({
        timestamp: new Date().toISOString(),
        channel: "sms_fallback",
        receiver: receiverForSend,
        message: smsMsg,
        testMode: normalizedTestMode,
        ok: smsResult.ok,
        mid: (smsBody?.info as Record<string, unknown>)?.mid ?? smsBody?.msg_id ?? null,
        originalChannel: "alimtalk",
        originalError: body?.code ?? null,
      });
      res.status(smsResult.ok ? 200 : smsResult.status ?? 502).json({
        ...smsResult,
        fallback: true,
        originalAlimtalkError: body?.message ?? "알림톡 발송 실패",
      });
      return;
    }

    res.status(result.ok ? 200 : result.status ?? 502).json(result);
  });

  router.post("/api/aligo/sms", async (req: Request, res: Response) => {
    const { receiver, message, testMode, consentStatus: smsConsentStatus, adminOverride: smsAdminOverride, daysSinceLastPurchase: smsDays, source: smsSource, memberCode: smsMemberCode, experimentKey: smsExperimentKey, groupId: smsGroupId, templateCode: smsTemplateCode, templateType: smsTemplateType } = (req.body ?? {}) as Record<string, unknown>;
    const normalizedReceiver = normalizePhoneNumber(receiver);
    const normalizedMessage = readRequiredString(message);
    const normalizedTestMode = resolveAligoTestMode(testMode);

    const requiredErrors = [
      ...(!normalizedReceiver ? [{ field: "receiver", code: "required", message: "receiver 필요" }] : []),
      ...(!normalizedMessage ? [{ field: "message", code: "required", message: "message 필요" }] : []),
    ];
    if (requiredErrors.length > 0) {
      res.status(400).json({ ok: false, error: requiredErrors[0].message, errors: requiredErrors });
      return;
    }
    const smsReceiverForSend = normalizedReceiver!;
    const smsMessageForSend = normalizedMessage!;
    const isSmsAdminOverride = smsAdminOverride === true || smsAdminOverride === "true";
    const normalizedSmsTemplateCode = readOptionalString(smsTemplateCode);
    const smsPolicy = evaluateForEnforcement({
      channel: "sms",
      receiver: smsReceiverForSend,
      memberCode: typeof smsMemberCode === "string" ? smsMemberCode : null,
      templateCode: normalizedSmsTemplateCode,
      templateType: typeof smsTemplateType === "string" ? smsTemplateType : null,
      body: smsMessageForSend,
      source: typeof smsSource === "string" ? smsSource : null,
      groupId: typeof smsGroupId === "string" ? smsGroupId : null,
      adminOverride: isSmsAdminOverride,
    });
    if (sendPolicyBlockedResponse(res, smsPolicy, {
      channel: "sms",
      receiver: smsReceiverForSend,
      templateCode: normalizedSmsTemplateCode,
      groupId: typeof smsGroupId === "string" ? smsGroupId : null,
      source: typeof smsSource === "string" ? smsSource : null,
    })) {
      return;
    }

    if (!ALIGO_RECEIVER_WHITELIST.includes(smsReceiverForSend) && !isSmsAdminOverride) {
      res.status(403).json({ ok: false, message: "수신자가 허용 목록에 없습니다. 관리자 강제 발송(adminOverride)을 사용하세요." });
      return;
    }

    const result = await sendAligoSms({
      receiver: smsReceiverForSend,
      message: smsMessageForSend,
      testMode: normalizedTestMode,
    });

    const smsBody = (result.ok ? result.body : result.body) as Record<string, unknown> | undefined;
    await appendSendLog({
      timestamp: new Date().toISOString(),
      channel: "sms",
      consentStatus: smsConsentStatus ?? null,
      adminOverride: smsAdminOverride === true || smsAdminOverride === "true",
      daysSinceLastPurchase: typeof smsDays === "number" ? smsDays : null,
      memberCode: typeof smsMemberCode === "string" && smsMemberCode ? smsMemberCode : null,
      source: smsSource ?? null,
      receiver: smsReceiverForSend,
      message: smsMessageForSend,
      testMode: normalizedTestMode,
      ok: result.ok,
      mid: (smsBody?.info as Record<string, unknown>)?.mid ?? smsBody?.msg_id ?? null,
      errorCode: smsBody?.result_code ?? null,
      errorMessage: result.ok ? null : (smsBody?.message ?? null),
    });

    // crm_message_log에 기록 (전화번호 기준)
    if (smsReceiverForSend) {
      try {
        recordMessage({
          experiment_key: typeof smsExperimentKey === "string" && smsExperimentKey ? smsExperimentKey : undefined,
          customer_key: smsReceiverForSend,
          channel: "sms",
          provider_status: result.ok ? "success" : "fail",
          template_code: normalizedSmsTemplateCode ?? undefined,
        });
      } catch { /* 로그 실패는 무시 */ }
    }

    res.status(result.ok ? 200 : result.status ?? 502).json(result);
  });

  router.post("/api/aligo/test-send", async (req: Request, res: Response) => {
    const { tplCode, receiver, recvname, subject, message, emtitle, button, senddate, failover, fsubject, fmessage } =
      req.body ?? {};

    if (!tplCode || !receiver || !subject || !message) {
      res.status(400).json({
        ok: false,
        error: "tplCode, receiver, subject, message are required",
      });
      return;
    }

    const result = await sendAligoTest({
      tplCode,
      receiver,
      recvname,
      subject,
      message,
      emtitle,
      button,
      senddate,
      failover,
      fsubject,
      fmessage,
      testMode: "Y",
    });
    res.status(result.ok ? 200 : result.status ?? 502).json(result);
  });

  router.post("/api/aligo/render-preview", async (req: Request, res: Response) => {
    const { templateCode, variables } = (req.body ?? {}) as Record<string, unknown>;
    const normalizedTemplateCode = readRequiredString(templateCode);
    const normalizedVariables = readOptionalStringRecord(variables);

    if (!normalizedTemplateCode) {
      res.status(400).json({
        ok: false,
        error: "templateCode is required",
      });
      return;
    }

    if (normalizedVariables === null) {
      res.status(400).json({
        ok: false,
        error: "variables must be an object of string values",
      });
      return;
    }

    const result = await renderAligoPreview({
      templateCode: normalizedTemplateCode,
      variables: normalizedVariables,
    });
    res.json(result);
  });

  // ── 템플릿 생성/검수/삭제 ──

  router.post("/api/aligo/template/create", async (req: Request, res: Response) => {
    const { tplName, tplContent, templateType, buttons } = (req.body ?? {}) as Record<string, unknown>;
    const name = readRequiredString(tplName);
    const content = readRequiredString(tplContent);
    if (!name || !content) {
      res.status(400).json({ ok: false, error: "tplName, tplContent are required" });
      return;
    }
    const result = await createAligoTemplate({
      tplName: name,
      tplContent: content,
      templateType: readOptionalString(templateType) ?? undefined,
      buttons,
    });
    res.status(result.ok ? 200 : result.status ?? 502).json(result);
  });

  router.post("/api/aligo/template/request-review", async (req: Request, res: Response) => {
    const tplCode = readRequiredString((req.body ?? {}).tplCode);
    if (!tplCode) {
      res.status(400).json({ ok: false, error: "tplCode is required" });
      return;
    }
    const result = await requestAligoTemplateReview(tplCode);
    res.status(result.ok ? 200 : result.status ?? 502).json(result);
  });

  router.post("/api/aligo/template/delete", async (req: Request, res: Response) => {
    const tplCode = readRequiredString((req.body ?? {}).tplCode);
    if (!tplCode) {
      res.status(400).json({ ok: false, error: "tplCode is required" });
      return;
    }
    const result = await deleteAligoTemplate(tplCode);
    res.status(result.ok ? 200 : result.status ?? 502).json(result);
  });

  // 발송 로그 조회
  router.get("/api/aligo/send-log", async (_req: Request, res: Response) => {
    try {
      const raw = await fs.readFile(SEND_LOG_PATH, "utf8").catch(() => "");
      const lines = raw.trim().split("\n").filter(Boolean);
      const entries = lines.map((line) => { try { return JSON.parse(line); } catch { return null; } }).filter(Boolean);
      res.json({ ok: true, total: entries.length, entries: entries.slice(-100).reverse() });
    } catch {
      res.json({ ok: true, total: 0, entries: [] });
    }
  });

  return router;
};

const parsePositiveInteger = (value: unknown, defaultValue: number): number | null => {
  if (value === undefined || value === null || value === "") return defaultValue;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const parseDateToken = (value: unknown): string | null | undefined => {
  if (value === undefined || value === null || value === "") return undefined;
  const raw = String(value).trim();
  const normalized = raw.replaceAll("-", "");
  return /^\d{8}$/.test(normalized) ? normalized : null;
};

const normalizePhoneNumber = (value: unknown): string | null => {
  const raw = readRequiredString(value);
  if (!raw) return null;
  return raw.replaceAll("-", "").replaceAll(" ", "");
};

const readRequiredString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
};

const readOptionalString = (value: unknown): string | null => {
  if (value === undefined || value === null) return null;
  return readRequiredString(value);
};

const resolveAligoTestMode = (value: unknown): "Y" | "N" => {
  return typeof value === "string" && value.trim().toUpperCase() === "N" ? "N" : "Y";
};

const readOptionalStringRecord = (
  value: unknown,
): Record<string, string> | null | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "object" || Array.isArray(value)) return null;

  const normalized: Record<string, string> = {};
  for (const [rawKey, rawValue] of Object.entries(value)) {
    const normalizedKey = rawKey.trim();
    if (!normalizedKey || typeof rawValue !== "string") return null;
    normalized[normalizedKey] = rawValue;
  }

  return normalized;
};

function sendPolicyBlockedResponse(
  res: Response,
  policy: ContactPolicyEnforcementResult,
  context: {
    channel: string;
    receiver: string | null;
    templateCode?: string | null;
    groupId?: string | null;
    source?: string | null;
  },
): boolean {
  const hardLegalReasons = policy.blockedReasons.filter((reason) => reason.severity === "hard_legal");
  if (hardLegalReasons.length > 0) {
    log.warn({
      event: obsEvents.contactPolicyDecision,
      decision: "blocked",
      severity: "hard_legal",
      reasons: hardLegalReasons,
      ...context,
    });
    res.status(451).json(toPolicyBlockedBody("hard_legal", hardLegalReasons));
    return true;
  }

  const hardPolicyReasons = policy.blockedReasons.filter((reason) => reason.severity === "hard_policy");
  if (hardPolicyReasons.length > 0 && !policy.adminOverride) {
    log.warn({
      event: obsEvents.contactPolicyDecision,
      decision: "blocked",
      severity: "hard_policy",
      reasons: hardPolicyReasons,
      ...context,
    });
    res.status(403).json(toPolicyBlockedBody("hard_policy", hardPolicyReasons));
    return true;
  }

  if (policy.adminOverride && policy.blockedReasons.length > 0) {
    log.warn({
      event: obsEvents.contactPolicyDecision,
      decision: "admin_override_allowed",
      severity: highestPolicySeverity(policy),
      reasons: policy.blockedReasons,
      ...context,
    });
  }

  return false;
}

function toPolicyBlockedBody(
  severity: EnforcementSeverity,
  reasons: ContactPolicyEnforcementResult["blockedReasons"],
) {
  return {
    ok: false,
    blocked_by_policy: true,
    severity,
    reasons,
  };
}

function highestPolicySeverity(policy: ContactPolicyEnforcementResult): EnforcementSeverity {
  if (policy.blockedReasons.some((reason) => reason.severity === "hard_legal")) return "hard_legal";
  if (policy.blockedReasons.some((reason) => reason.severity === "hard_policy")) return "hard_policy";
  return "soft";
}
