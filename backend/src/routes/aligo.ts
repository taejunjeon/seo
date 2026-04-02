import express, { type Request, type Response } from "express";

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

const ALIGO_RECEIVER_WHITELIST = ["01039348641"];

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
    const { tplCode, receiver, recvname, subject, message, emtitle, button, testMode } =
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

    if (!ALIGO_RECEIVER_WHITELIST.includes(normalizedReceiver)) {
      res.status(403).json({
        ok: false,
        message: "수신자가 허용 목록에 없습니다",
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
    res.status(result.ok ? 200 : result.status ?? 502).json(result);
  });

  router.post("/api/aligo/sms", async (req: Request, res: Response) => {
    const { receiver, message, testMode } = (req.body ?? {}) as Record<string, unknown>;
    const normalizedReceiver = normalizePhoneNumber(receiver);
    const normalizedMessage = readRequiredString(message);
    const normalizedTestMode = resolveAligoTestMode(testMode);

    if (!normalizedReceiver || !normalizedMessage) {
      res.status(400).json({ ok: false, error: "receiver, message are required" });
      return;
    }
    if (!ALIGO_RECEIVER_WHITELIST.includes(normalizedReceiver)) {
      res.status(403).json({ ok: false, message: "수신자가 허용 목록에 없습니다" });
      return;
    }

    const result = await sendAligoSms({
      receiver: normalizedReceiver,
      message: normalizedMessage,
      testMode: normalizedTestMode,
    });
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
