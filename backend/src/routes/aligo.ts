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
    const { tplCode, receiver, recvname, subject, message, emtitle, button, testMode, consentStatus, adminOverride: reqAdminOverride, daysSinceLastPurchase, source: sendSource, memberCode } =
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

    if (!normalizedTplCode || !normalizedReceiver || !normalizedSubject || !normalizedMessage) {
      res.status(400).json({
        ok: false,
        error: "tplCode, receiver, subject, message are required",
      });
      return;
    }

    const isAdminOverride = reqAdminOverride === true || reqAdminOverride === "true";
    if (!ALIGO_RECEIVER_WHITELIST.includes(normalizedReceiver) && !isAdminOverride) {
      res.status(403).json({
        ok: false,
        message: "수신자가 허용 목록에 없습니다. 관리자 강제 발송(adminOverride)을 사용하세요.",
      });
      return;
    }

    const result = await sendAligo({
      tplCode: normalizedTplCode,
      receiver: normalizedReceiver,
      recvname: normalizedRecvname ?? undefined,
      subject: normalizedSubject,
      message: normalizedMessage,
      emtitle: normalizedEmtitle ?? undefined,
      button,
      testMode: normalizedTestMode,
    });

    const body = (result.ok ? result.body : result.body) as Record<string, unknown> | undefined;
    await appendSendLog({
      timestamp,
      channel: "alimtalk",
      receiver: normalizedReceiver,
      recvname: normalizedRecvname,
      tplCode: normalizedTplCode,
      subject: normalizedSubject,
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

    // crm_message_log에도 기록 (memberCode가 있을 때)
    if (typeof memberCode === "string" && memberCode) {
      try {
        recordMessage({
          customer_key: memberCode,
          channel: "alimtalk",
          provider_status: result.ok ? "success" : "fail",
          template_code: normalizedTplCode,
        });
      } catch { /* 로그 실패는 무시 */ }
    }

    // SMS fallback: 알림톡 실패 시 자동 SMS 발송
    const { fallbackSms, fallbackMessage } = (req.body ?? {}) as Record<string, unknown>;
    if (!result.ok && fallbackSms && normalizedMessage) {
      const smsMsg = readOptionalString(fallbackMessage) ?? normalizedMessage;
      const smsResult = await sendAligoSms({
        receiver: normalizedReceiver,
        message: smsMsg,
        testMode: normalizedTestMode,
      });
      const smsBody = (smsResult.ok ? smsResult.body : smsResult.body) as Record<string, unknown> | undefined;
      await appendSendLog({
        timestamp: new Date().toISOString(),
        channel: "sms_fallback",
        receiver: normalizedReceiver,
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
    const { receiver, message, testMode, consentStatus: smsConsentStatus, adminOverride: smsAdminOverride, daysSinceLastPurchase: smsDays, source: smsSource, memberCode: smsMemberCode } = (req.body ?? {}) as Record<string, unknown>;
    const normalizedReceiver = normalizePhoneNumber(receiver);
    const normalizedMessage = readRequiredString(message);
    const normalizedTestMode = resolveAligoTestMode(testMode);

    if (!normalizedReceiver || !normalizedMessage) {
      res.status(400).json({ ok: false, error: "receiver, message are required" });
      return;
    }
    const isSmsAdminOverride = smsAdminOverride === true || smsAdminOverride === "true";
    if (!ALIGO_RECEIVER_WHITELIST.includes(normalizedReceiver) && !isSmsAdminOverride) {
      res.status(403).json({ ok: false, message: "수신자가 허용 목록에 없습니다. 관리자 강제 발송(adminOverride)을 사용하세요." });
      return;
    }

    const result = await sendAligoSms({
      receiver: normalizedReceiver,
      message: normalizedMessage,
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
      receiver: normalizedReceiver,
      message: normalizedMessage,
      testMode: normalizedTestMode,
      ok: result.ok,
      mid: (smsBody?.info as Record<string, unknown>)?.mid ?? smsBody?.msg_id ?? null,
      errorCode: smsBody?.result_code ?? null,
      errorMessage: result.ok ? null : (smsBody?.message ?? null),
    });

    // crm_message_log에도 기록 (memberCode가 있을 때)
    if (typeof smsMemberCode === "string" && smsMemberCode) {
      try {
        recordMessage({
          customer_key: smsMemberCode,
          channel: "sms",
          provider_status: result.ok ? "success" : "fail",
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
