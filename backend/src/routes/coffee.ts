import { type Request, type Response, Router } from "express";

import {
  getCoffeeNpayIntentLogStats,
  runDryRun as runCoffeeNpayIntentDryRun,
} from "../coffeeNpayIntentLog";
import { getSubscriberTrackStats, syncSubscriberTracks } from "../subscriberTrackSync";
import {
  TEMPLATES,
  dispatchChurnPrevention,
  dispatchTrackPromotions,
  getNotificationStats,
} from "../subscriberTrackNotifier";

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

  return router;
};
