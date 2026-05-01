import { type Request, type Response, Router } from "express";

import {
  bumpRejectCounter,
  checkOriginAllowlist,
  checkRateLimit,
  getCoffeeNpayIntentJoinReport,
  getCoffeeNpayIntentLogStats,
  listCoffeeNpayIntents,
  runDryRun as runCoffeeNpayIntentDryRun,
  runEnforceInsert as runCoffeeNpayIntentEnforce,
} from "../coffeeNpayIntentLog";
import { getSubscriberTrackStats, syncSubscriberTracks } from "../subscriberTrackSync";
import {
  TEMPLATES,
  dispatchChurnPrevention,
  dispatchTrackPromotions,
  getNotificationStats,
} from "../subscriberTrackNotifier";

/**
 * NPay intent endpoint hardening guard:
 *   - Origin / Referer allowlist (thecleancoffee.com / www.thecleancoffee.com.
 *     dev override 는 env COFFEE_NPAY_INTENT_DEV_BYPASS=true)
 *   - Rate limit: per IP+session_uuid 키. 1초 5회, 1분 30회. window 60초.
 *   - reject 시 reject_counter bump + 표준화된 에러 응답
 */
function applyCoffeeIntentGuard(req: Request):
  | { allowed: true }
  | { allowed: false; status: number; body: Record<string, unknown> } {
  const origin = (req.headers.origin as string | undefined) ?? "";
  const referer = (req.headers.referer as string | undefined) ?? "";
  const originCheck = checkOriginAllowlist(origin, referer);
  if (!originCheck.allowed) {
    bumpRejectCounter("invalid_origin");
    return {
      allowed: false,
      status: 403,
      body: {
        ok: false,
        reason: "invalid_origin",
        origin,
        referer,
        allowed_origins: ["https://thecleancoffee.com", "https://www.thecleancoffee.com"],
        note: "Origin/Referer not in allowlist. dev bypass: env COFFEE_NPAY_INTENT_DEV_BYPASS=true",
      },
    };
  }
  // rate limit 키: ip + session_uuid (있으면). 둘 다 없으면 ip 만.
  const ipRaw =
    (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    "unknown";
  const sessionUuid =
    typeof req.body?.session_uuid === "string" && req.body.session_uuid
      ? req.body.session_uuid
      : "";
  const rlKey = sessionUuid ? `${ipRaw}::${sessionUuid}` : ipRaw;
  const rl = checkRateLimit(rlKey);
  if (!rl.allowed) {
    bumpRejectCounter("rate_limited");
    return {
      allowed: false,
      status: 429,
      body: {
        ok: false,
        reason: "rate_limited",
        rate_limit_reason: rl.reason,
        recent_count_in_window: rl.recent_count,
        retry_after_ms: 1000,
      },
    };
  }
  return { allowed: true };
}

export const createCoffeeRouter = () => {
  const router = Router();

  /**
   * 정기구독 트랙 카운터 sync (멱등 · 매일 1회 권장)
   * 1. coffee_payments_excel 정기결제 행 스캔
   * 2. phone별 lifetime + 12개월 카운터 갱신
   * 3. 트랙 변경 시 coffee_subscriber_track_log에 기록 (알림톡 트리거용)
   */
  router.post("/api/coffee/sync-subscriber-tracks", (_req: Request, res: Response) => {
    try {
      const result = syncSubscriberTracks();
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "sync failed" });
    }
  });

  /**
   * 트랙 등급 분포 + 이탈 위험 + 최근 변경 이력
   */
  router.get("/api/coffee/subscriber-tracks", (_req: Request, res: Response) => {
    try {
      res.json({ ok: true, ...getSubscriberTrackStats() });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "query failed" });
    }
  });

  /**
   * 알림톡 템플릿 정의 + .env 등록 상태 (사전 검수 가이드용)
   */
  router.get("/api/coffee/notification-templates", (_req: Request, res: Response) => {
    const list = Object.values(TEMPLATES).map((t) => ({
      key: t.key,
      name: t.name,
      subject: t.subject,
      env_code_key: t.envCodeKey,
      registered: !!process.env[t.envCodeKey],
      description: t.description,
      sample_message: t.contentTemplate({
        name: "홍길동",
        next: "5",
        paid12m: "12",
        track: "MANIAC",
        recoverDate: "2026-12-31",
      }),
    }));
    res.json({ ok: true, templates: list });
  });

  /**
   * 트랙 진입 알림톡 발송 (직전 24시간 변경 → 4종 진입 템플릿)
   * body: { liveMode?: boolean, dryRun?: boolean, limit?: number }
   * - liveMode=false (default) → testMode='Y' (알리고 testMode 발송)
   * - dryRun=true → 알리고 호출 안함, log 'skipped' 만 기록
   */
  router.post("/api/coffee/dispatch-track-promotions", async (req: Request, res: Response) => {
    try {
      const result = await dispatchTrackPromotions({
        liveMode: !!req.body?.liveMode,
        dryRun: !!req.body?.dryRun,
        limit: typeof req.body?.limit === "number" ? req.body.limit : undefined,
      });
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "dispatch failed" });
    }
  });

  /**
   * 이탈 방지 시퀀스 발송 (30일+ gentle, 60일+ recovery)
   * body 동일
   */
  router.post("/api/coffee/dispatch-churn-prevention", async (req: Request, res: Response) => {
    try {
      const result = await dispatchChurnPrevention({
        liveMode: !!req.body?.liveMode,
        dryRun: !!req.body?.dryRun,
        limit: typeof req.body?.limit === "number" ? req.body.limit : undefined,
      });
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "dispatch failed" });
    }
  });

  /**
   * 알림톡 발송 통계 (템플릿별 status + 최근 30건)
   */
  router.get("/api/coffee/notification-stats", (_req: Request, res: Response) => {
    try {
      res.json({ ok: true, ...getNotificationStats() });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "query failed" });
    }
  });

  /**
   * NPay intent beacon dry-run intake (preview snippet v0.4 + v0.5 의 buffer 를
   * backend 로 forward 할 때 사용).
   *
   * 본 endpoint 는 **dry-run only**:
   *   - schema 는 CREATE TABLE IF NOT EXISTS 로 미리 만든다 (coffee_npay_intent_log)
   *   - payload 검증 + ledger row preview 만 응답
   *   - 실제 INSERT 는 enforce mode 가 켜진 뒤 (별도 phase) 에만 실행
   *
   * 가드:
   *   - PII 키 (phone/email/name/address/option 원문) 가 payload 에 있으면 reject
   *   - external API 호출 / GA4 / Meta CAPI / TikTok / Google Ads 송출 0건
   *   - local SQLite write 도 enforce 전까지 0건
   *   - preview snippet 자체는 fetch 금지이므로 본 endpoint 는 향후 GTM Preview
   *     workspace 또는 별도 dispatcher 를 통해서만 호출됨
   */
  router.post("/api/coffee/intent/dry-run", (req: Request, res: Response) => {
    const guard = applyCoffeeIntentGuard(req);
    if (!guard.allowed) {
      res.status(guard.status).json(guard.body);
      return;
    }
    try {
      const result = runCoffeeNpayIntentDryRun(req.body ?? {});
      res.status(result.ok ? 200 : 400).json(result);
    } catch (err) {
      res.status(500).json({
        ok: false,
        error: err instanceof Error ? err.message : "intent_dry_run failed",
      });
    }
  });

  /**
   * NPay intent log 통계 (schema 가 살아있는지 + row 카운트). dry-run 단계에서는
   * 항상 row 0. enforce mode 가 켜진 뒤 row 가 쌓이면 imweb_order_code / ga4_
   * synthetic_transaction_id 매핑 채워진 row 수가 늘어난다.
   */
  router.get("/api/coffee/intent/stats", (_req: Request, res: Response) => {
    try {
      res.json(getCoffeeNpayIntentLogStats());
    } catch (err) {
      res.status(500).json({
        ok: false,
        error: err instanceof Error ? err.message : "intent_stats failed",
      });
    }
  });

  /**
   * A-1 phase — TJ 권장 path. mode query param 으로 dry_run / enforce 분기.
   * - mode=dry_run (default) → runDryRun (INSERT 0)
   * - mode=enforce → runEnforceInsert (env flag COFFEE_NPAY_INTENT_ENFORCE_LIVE
   *   가 'true' 일 때만 실제 INSERT, 아니면 reject). 본 phase 의 운영 backend
   *   는 env flag 미설정 → INSERT 호출이 와도 항상 reject.
   */
  router.post(
    "/api/attribution/coffee-npay-intent",
    (req: Request, res: Response) => {
      const guard = applyCoffeeIntentGuard(req);
      if (!guard.allowed) {
        res.status(guard.status).json(guard.body);
        return;
      }
      try {
        const mode = String(req.query.mode ?? "dry_run").toLowerCase();
        if (mode === "enforce") {
          const result = runCoffeeNpayIntentEnforce(req.body ?? {});
          res.status(result.inserted ? 201 : result.deduped ? 200 : 400).json(result);
          return;
        }
        const result = runCoffeeNpayIntentDryRun(req.body ?? {});
        res.status(result.ok ? 200 : 400).json(result);
      } catch (err) {
        res.status(500).json({
          ok: false,
          error: err instanceof Error ? err.message : "coffee_npay_intent failed",
        });
      }
    },
  );

  /**
   * A-1 phase — read-only 최근 N건 ledger 조회 (PII 컬럼 제외).
   * 본 phase 는 ledger 가 비어 있으므로 빈 배열 응답.
   */
  router.get(
    "/api/attribution/coffee-npay-intents",
    (req: Request, res: Response) => {
      try {
        const site = String(req.query.site ?? "thecleancoffee");
        const limit = Math.min(
          Math.max(Number(req.query.limit ?? 50) || 50, 1),
          200,
        );
        const withCode = String(req.query.with_imweb_order_code ?? "") === "true";
        const items = listCoffeeNpayIntents({
          site,
          limit,
          withImwebOrderCode: withCode,
        });
        res.json({
          ok: true,
          site,
          limit,
          with_imweb_order_code_filter: withCode,
          stats: getCoffeeNpayIntentLogStats(),
          items,
        });
      } catch (err) {
        res.status(500).json({
          ok: false,
          error:
            err instanceof Error ? err.message : "coffee_npay_intents list failed",
        });
      }
    },
  );

  /**
   * A-1 phase — 7일 모니터링용 join dry-run 리포트.
   * coffee_npay_intent_log.imweb_order_code = imweb_orders.order_code 매핑.
   * 5종 join_status: joined_confirmed_order / pending_order_sync /
   * no_order_after_24h / duplicated_intent / invalid_payload.
   */
  router.get(
    "/api/attribution/coffee-npay-intent-join-report",
    (req: Request, res: Response) => {
      try {
        const site = String(req.query.site ?? "thecleancoffee");
        const windowDays = Number(req.query.window_days ?? 7) || 7;
        const limit = Number(req.query.limit ?? 200) || 200;
        res.json(
          getCoffeeNpayIntentJoinReport({ site, windowDays, limit }),
        );
      } catch (err) {
        res.status(500).json({
          ok: false,
          error: err instanceof Error ? err.message : "join_report failed",
        });
      }
    },
  );

  return router;
};
