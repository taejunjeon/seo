import express, { type Request, type Response } from "express";

import { getChannelTalkConfigStatus, verifyChannelTalkAccess, normalizeChannelTalkConfig } from "../channeltalk";
import { evaluateContactPolicy, evaluateForEnforcement, getContactPolicyContract, type ContactPolicyInput } from "../contactPolicy";
import { getImwebMemberByPhone, getImwebMembersByPhones } from "../crmLocalDb";

type ChannelTalkUserSummary = {
  userId: string;
  type: string;
  name: string | null;
  mobileNumber: string | null;
  email: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  lastSeenAt: string | null;
};

export const createChannelTalkRouter = () => {
  const router = express.Router();

  router.get("/api/channeltalk/status", (_req: Request, res: Response) => {
    res.json({
      ok: true,
      config: getChannelTalkConfigStatus(),
    });
  });

  router.get("/api/channeltalk/health", async (_req: Request, res: Response) => {
    const config = getChannelTalkConfigStatus();
    const probe = await verifyChannelTalkAccess();

    if (!probe.ok) {
      const statusCode =
        probe.reason === "missing_credentials"
          ? 400
          : typeof probe.status === "number" && probe.status >= 400
            ? probe.status
            : 502;

      res.status(statusCode).json({
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

  /* ── 채널톡 사용자 요약 — user-chats 기반 파이프라인 ── */
  router.get("/api/channeltalk/users-summary", async (_req: Request, res: Response) => {
    const cfg = normalizeChannelTalkConfig();
    if (!cfg.accessKey || !cfg.accessSecret) {
      res.status(400).json({ ok: false, error: "CHANNELTALK_ACCESS_KEY/SECRET 미설정" });
      return;
    }

    const headers: Record<string, string> = {
      accept: "application/json",
      "x-access-key": cfg.accessKey,
      "x-access-secret": cfg.accessSecret,
    };

    try {
      // user-chats 페이지네이션으로 사용자 수집 (최대 500건)
      const userMap = new Map<string, ChannelTalkUserSummary>();
      let cursor: string | null = null;
      let pages = 0;
      const maxPages = 5;

      while (pages < maxPages) {
        const url = cursor
          ? `https://api.channel.io/open/v5/user-chats?limit=100&sortOrder=desc&since=${cursor}`
          : "https://api.channel.io/open/v5/user-chats?limit=100&sortOrder=desc";

        const chatRes = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
        if (!chatRes.ok) break;

        const data = await chatRes.json() as {
          userChats?: Array<{ id: string; userId: string }>;
          users?: Array<{
            id: string;
            type?: string;
            profile?: Record<string, string | null>;
            lastSeenAt?: number;
          }>;
          next?: string;
        };

        for (const u of data.users ?? []) {
          if (userMap.has(u.id)) continue;
          const p = u.profile ?? {};
          userMap.set(u.id, {
            userId: u.id,
            type: u.type ?? "unknown",
            name: p.name ?? null,
            mobileNumber: p.mobileNumber ?? null,
            email: p.email ?? null,
            utmSource: p.utmSource ?? null,
            utmMedium: p.utmMedium ?? null,
            utmCampaign: p.utmCampaign ?? null,
            lastSeenAt: u.lastSeenAt ? new Date(u.lastSeenAt).toISOString() : null,
          });
        }

        pages++;
        if (!data.next || (data.userChats?.length ?? 0) < 100) break;
        cursor = data.next;
      }

      const users = [...userMap.values()];

      // 집계
      const byType: Record<string, number> = {};
      const byUtmSource: Record<string, number> = {};
      let withPhone = 0;
      let withEmail = 0;

      for (const u of users) {
        byType[u.type] = (byType[u.type] ?? 0) + 1;
        if (u.utmSource) byUtmSource[u.utmSource] = (byUtmSource[u.utmSource] ?? 0) + 1;
        if (u.mobileNumber) withPhone++;
        if (u.email) withEmail++;
      }

      const utmSourceRanked = Object.entries(byUtmSource)
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count);

      res.json({
        ok: true,
        summary: {
          totalUsers: users.length,
          byType,
          withPhone,
          withEmail,
          pagesScanned: pages,
        },
        utmSources: utmSourceRanked,
        users: users.slice(0, 50),
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "ChannelTalk users-summary failed";
      res.status(500).json({ ok: false, error: msg });
    }
  });

  /* ── Webhook 수신 ── */
  router.post("/api/channeltalk/webhook", async (req: Request, res: Response) => {
    const payload = req.body ?? {};
    const event = typeof payload.event === "string" ? payload.event : "unknown";
    const entity = payload.entity ?? payload.refers ?? {};

    const entry = {
      receivedAt: new Date().toISOString(),
      event,
      entity: typeof entity === "object" ? entity : {},
      rawKeys: Object.keys(payload),
    };

    // JSONL에 append
    const logPath = require("node:path").resolve(__dirname, "..", "..", "logs", "channeltalk-webhooks.jsonl");
    const fs = require("node:fs").promises;
    await fs.mkdir(require("node:path").dirname(logPath), { recursive: true });
    await fs.appendFile(logPath, `${JSON.stringify(entry)}\n`, "utf8");

    res.status(200).json({ ok: true, event, receivedAt: entry.receivedAt });
  });

  /* ── Webhook 로그 조회 ── */
  router.get("/api/channeltalk/webhooks", async (_req: Request, res: Response) => {
    const logPath = require("node:path").resolve(__dirname, "..", "..", "logs", "channeltalk-webhooks.jsonl");
    const fs = require("node:fs").promises;
    try {
      const content = await fs.readFile(logPath, "utf8");
      const entries = content
        .split("\n")
        .filter((l: string) => l.trim())
        .map((l: string) => JSON.parse(l))
        .reverse();
      res.json({ ok: true, total: entries.length, items: entries.slice(0, 50) });
    } catch (error) {
      const msg = error instanceof Error && error.message.includes("ENOENT") ? "아직 수신된 webhook이 없다" : String(error);
      res.json({ ok: true, total: 0, items: [], note: msg });
    }
  });

  /* ── 발송 정책 판단 ── */
  router.get("/api/contact-policy/contract", (_req: Request, res: Response) => {
    res.json(getContactPolicyContract());
  });

  router.post("/api/contact-policy/evaluate", (req: Request, res: Response) => {
    const channel = (req.body?.channel ?? "aligo") as "channeltalk" | "aligo" | "sms";
    if (channel !== "channeltalk" && channel !== "aligo" && channel !== "sms") {
      res.status(400).json({ error: `지원하지 않는 채널: ${channel}. channeltalk, aligo, sms만 가능` });
      return;
    }

    // consent 자동 조회: consentStatus가 없고 customerPhone이 있으면 imweb_members에서 조회
    let resolvedConsent = req.body?.consentStatus ?? null;
    let consentSource: string | null = null;
    if (!resolvedConsent && req.body?.customerPhone) {
      const phone = String(req.body.customerPhone).replace(/[^0-9]/g, "");
      const member = getImwebMemberByPhone(phone);
      if (member) {
        resolvedConsent = member.marketing_agree_sms === "Y" ? "marketing_opt_in" : "not_agreed";
        consentSource = "imweb_members_auto";
      }
    }

    const candidate: ContactPolicyInput = {
      consentStatus: resolvedConsent,
      claimReviewStatus: req.body?.claimReviewStatus ?? null,
      recentMessageCount7d: req.body?.recentMessageCount7d ?? null,
      hoursSinceLastMessage: req.body?.hoursSinceLastMessage ?? null,
      daysSinceLastPurchase: req.body?.daysSinceLastPurchase ?? null,
      daysSinceLastConsultation: req.body?.daysSinceLastConsultation ?? null,
      suppressionUntil: req.body?.suppressionUntil ?? null,
      customerPhone: req.body?.customerPhone ?? null,
      customerEmail: req.body?.customerEmail ?? null,
    };
    const adminOverride = req.body?.adminOverride === true;
    const result = evaluateContactPolicy(candidate, channel, { adminOverride });
    const enforcement = evaluateForEnforcement({
      channel,
      receiver: req.body?.customerPhone ?? null,
      memberCode: req.body?.memberCode ?? null,
      templateCode: req.body?.templateCode ?? req.body?.tplCode ?? null,
      templateType: req.body?.templateType ?? null,
      body: req.body?.message ?? req.body?.body ?? null,
      source: req.body?.source ?? null,
      groupId: req.body?.groupId ?? null,
      batchSize: typeof req.body?.batchSize === "number" ? req.body.batchSize : null,
      adminOverride,
    });
    res.json({ ...result, consentSource, enforcement });
  });

  router.post("/api/contact-policy/evaluate-batch", (req: Request, res: Response) => {
    const channel = (req.body?.channel ?? "aligo") as "channeltalk" | "aligo" | "sms";
    if (channel !== "channeltalk" && channel !== "aligo" && channel !== "sms") {
      res.status(400).json({ error: `지원하지 않는 채널: ${channel}. channeltalk, aligo, sms만 가능` });
      return;
    }

    if (!Array.isArray(req.body?.phones) || req.body.phones.length === 0) {
      res.status(400).json({ error: "phones 배열이 필요하다" });
      return;
    }

    const phones = req.body.phones.map((phone: unknown) => String(phone ?? ""));
    const normalizedPhones = phones.map((phone: string) => phone.replace(/[^0-9]/g, ""));
    const members = getImwebMembersByPhones(normalizedPhones);
    const memberByPhone = new Map<string, (typeof members)[number]>();

    for (const member of members) {
      const normalizedPhone = member.callnum.replace(/[^0-9]/g, "");
      if (normalizedPhone && !memberByPhone.has(normalizedPhone)) {
        memberByPhone.set(normalizedPhone, member);
      }
    }

    const adminOverride = req.body?.adminOverride === true;
    const sharedInput = {
      claimReviewStatus: req.body?.claimReviewStatus ?? null,
      recentMessageCount7d: req.body?.recentMessageCount7d ?? null,
      hoursSinceLastMessage: req.body?.hoursSinceLastMessage ?? null,
      daysSinceLastPurchase: req.body?.daysSinceLastPurchase ?? null,
      daysSinceLastConsultation: req.body?.daysSinceLastConsultation ?? null,
      suppressionUntil: req.body?.suppressionUntil ?? null,
    };

    const results = phones.map((phone: string) => {
      const normalizedPhone = phone.replace(/[^0-9]/g, "");
      const member = memberByPhone.get(normalizedPhone);

      let resolvedConsent = req.body?.consentStatus ?? null;
      let consentSource: string | null = null;
      if (!resolvedConsent && member) {
        resolvedConsent = member.marketing_agree_sms === "Y" ? "marketing_opt_in" : "not_agreed";
        consentSource = "imweb_members_batch";
      }

      const candidate: ContactPolicyInput = {
        consentStatus: resolvedConsent,
        claimReviewStatus: sharedInput.claimReviewStatus,
        recentMessageCount7d: sharedInput.recentMessageCount7d,
        hoursSinceLastMessage: sharedInput.hoursSinceLastMessage,
        daysSinceLastPurchase: sharedInput.daysSinceLastPurchase,
        daysSinceLastConsultation: sharedInput.daysSinceLastConsultation,
        suppressionUntil: sharedInput.suppressionUntil,
        customerPhone: normalizedPhone || null,
        customerEmail: member?.email ?? null,
      };

      const evaluation = evaluateContactPolicy(candidate, channel, { adminOverride });

      return {
        phone,
        normalizedPhone: normalizedPhone || null,
        memberCode: member?.member_code ?? null,
        name: member?.name ?? null,
        consentSource,
        ...evaluation,
      };
    });

    const eligible = results.filter((result: { eligible: boolean }) => result.eligible).length;

    res.json({
      total: results.length,
      eligible,
      blocked: results.length - eligible,
      results,
    });
  });

  return router;
};
