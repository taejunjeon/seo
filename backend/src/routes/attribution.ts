import express, { type Request, type Response } from "express";

import {
  appendLedgerEntry,
  buildAttributionHourlyCompare,
  buildLedgerEntry,
  buildLedgerSummary,
  buildTossReplayPlan,
  buildRequestContext,
  buildTossJoinReport,
  filterLedgerEntries,
  readLedgerEntries,
} from "../attribution";
import { isDatabaseConfigured, queryPg } from "../postgres";

type TossRow = {
  paymentKey: string | null;
  orderId: string | null;
  approvedAt: string | null;
  status: string | null;
  channel: string | null;
  store: string | null;
  totalAmount: number | null;
};

const parsePositiveInt = (value: unknown, fallback: number, max: number) => {
  const parsed = typeof value === "string" ? Number.parseInt(value, 10) : Number.NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(max, parsed));
};

const parseBooleanish = (value: unknown, fallback: boolean) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "y", "yes"].includes(normalized)) return true;
    if (["0", "false", "n", "no"].includes(normalized)) return false;
  }
  return fallback;
};

const resolveKstDate = (value: unknown) => {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return value.trim();
  }

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
};

const fetchTossRows = async (startDate: string, endDate: string, limit: number) => {
  if (!isDatabaseConfigured()) {
    return [];
  }

  const result = await queryPg<TossRow>(
    `
      SELECT
        payment_key AS "paymentKey",
        order_id AS "orderId",
        approved_at AS "approvedAt",
        status,
        channel,
        store,
        total_amount AS "totalAmount"
      FROM tb_sales_toss
      WHERE ($1 = '' OR SUBSTRING(COALESCE(approved_at, ''), 1, 10) >= $1)
        AND ($2 = '' OR SUBSTRING(COALESCE(approved_at, ''), 1, 10) <= $2)
      ORDER BY approved_at DESC NULLS LAST
      LIMIT $3
    `,
    [startDate, endDate, limit],
  );

  return result.rows.map((row) => ({
    paymentKey: row.paymentKey ?? "",
    orderId: row.orderId ?? "",
    approvedAt: row.approvedAt ?? "",
    status: row.status ?? "",
    channel: row.channel ?? "",
    store: row.store ?? "",
    totalAmount: Number(row.totalAmount ?? 0),
  }));
};

const fetchTossHourlyRows = async (date: string) => {
  if (!isDatabaseConfigured()) {
    return [];
  }

  const result = await queryPg<{
    dateHour: string | null;
    approvalCount: number | null;
    totalAmount: number | null;
  }>(
    `
      SELECT
        SUBSTRING(approved_at, 1, 13) || ':00' AS "dateHour",
        COUNT(*)::int AS "approvalCount",
        COALESCE(SUM(total_amount), 0)::float AS "totalAmount"
      FROM tb_sales_toss
      WHERE approved_at IS NOT NULL
        AND approved_at <> ''
        AND SUBSTRING(approved_at, 1, 10) = $1
      GROUP BY SUBSTRING(approved_at, 1, 13)
      ORDER BY SUBSTRING(approved_at, 1, 13) ASC
    `,
    [date],
  );

  return result.rows.map((row) => ({
    dateHour: row.dateHour ?? `${date} 00:00`,
    approvalCount: Number(row.approvalCount ?? 0),
    totalAmount: Number(row.totalAmount ?? 0),
  }));
};

// sendBeacon은 text/plain으로 보내므로 JSON 파싱 필요
const parseBody = (body: unknown): Record<string, unknown> => {
  if (typeof body === "string") {
    try { return JSON.parse(body); } catch { return {}; }
  }
  return (body as Record<string, unknown>) ?? {};
};

export const createAttributionRouter = () => {
  const router = express.Router();

  router.post("/api/attribution/form-submit", async (req: Request, res: Response) => {
    try {
      const body = parseBody(req.body);
      const entry = buildLedgerEntry("form_submit", body, buildRequestContext(req));

      // 중복 방지: 같은 source + 같은 formPage에서 10분 내 재제출 skip
      const formPage = typeof body.formPage === "string" ? body.formPage : "";
      const source = typeof body.source === "string" ? body.source : "";
      if (formPage && source) {
        const existing = await readLedgerEntries();
        const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        const duplicate = existing.find(
          (e) =>
            e.touchpoint === "form_submit" &&
            e.metadata?.source === source &&
            e.metadata?.formPage === formPage &&
            e.loggedAt > tenMinAgo,
        );
        if (duplicate) {
          res.status(200).json({
            ok: true,
            receiver: "form_submit",
            skipped: true,
            reason: "duplicate_form_submit",
          });
          return;
        }
      }

      const ledgerPath = await appendLedgerEntry(entry);
      res.status(201).json({
        ok: true,
        receiver: "form_submit",
        storedAt: ledgerPath,
        entry,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "form attribution logging failed";
      res.status(400).json({ ok: false, error: "form_attribution_log_error", message });
    }
  });

  router.post("/api/attribution/checkout-context", async (req: Request, res: Response) => {
    try {
      const entry = buildLedgerEntry("checkout_started", parseBody(req.body), buildRequestContext(req));
      const ledgerPath = await appendLedgerEntry(entry);
      res.status(201).json({
        ok: true,
        receiver: "checkout_context",
        storedAt: ledgerPath,
        entry,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "checkout attribution logging failed";
      res.status(400).json({ ok: false, error: "checkout_attribution_log_error", message });
    }
  });

  router.post("/api/attribution/payment-success", async (req: Request, res: Response) => {
    try {
      const entry = buildLedgerEntry("payment_success", parseBody(req.body), buildRequestContext(req));

      // 중복 방지: 같은 orderId가 최근 5분 내에 이미 적재되었으면 skip
      if (entry.orderId) {
        const existing = await readLedgerEntries();
        const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const duplicate = existing.find(
          (e) =>
            e.orderId === entry.orderId &&
            e.touchpoint === "payment_success" &&
            e.loggedAt > fiveMinAgo,
        );
        if (duplicate) {
          res.status(200).json({
            ok: true,
            receiver: "payment_success",
            skipped: true,
            reason: "duplicate_order_id",
            existingLoggedAt: duplicate.loggedAt,
          });
          return;
        }
      }

      const ledgerPath = await appendLedgerEntry(entry);
      res.status(201).json({
        ok: true,
        receiver: "payment_success",
        storedAt: ledgerPath,
        entry,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "payment attribution logging failed";
      res.status(400).json({ ok: false, error: "payment_attribution_log_error", message });
    }
  });

  router.get("/api/attribution/ledger", async (req: Request, res: Response) => {
    try {
      const allEntries = await readLedgerEntries();
      const source = typeof req.query.source === "string" ? req.query.source.trim() : "";
      const captureMode = typeof req.query.captureMode === "string" ? req.query.captureMode.trim() : "";
      const limit = parsePositiveInt(req.query.limit, 50, 200);

      const filtered = (source || captureMode)
        ? filterLedgerEntries(allEntries, {
            source: source || undefined,
            captureMode: captureMode || undefined,
          })
        : allEntries;

      res.json({
        ok: true,
        filters: { source: source || null, captureMode: captureMode || null },
        summary: buildLedgerSummary(filtered),
        allEntriesSummary: (source || captureMode) ? buildLedgerSummary(allEntries) : undefined,
        items: filtered.slice(0, limit),
        codebaseDiscovery: {
          successHandlerFoundInWorkspace: false,
          note:
            "현재 workspace에는 기존 PG successUrl/server callback 구현이 보이지 않아, 이 API를 표준 수신 엔드포인트로 추가했다.",
          canonicalReceivers: [
            "POST /api/attribution/checkout-context",
            "POST /api/attribution/payment-success",
            "POST /api/attribution/replay/toss",
          ],
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "attribution ledger read failed";
      res.status(500).json({ ok: false, error: "attribution_ledger_read_error", message });
    }
  });

  router.get("/api/attribution/toss-join", async (req: Request, res: Response) => {
    try {
      const limit = parsePositiveInt(req.query.limit, 100, 500);
      const startDate = typeof req.query.startDate === "string" ? req.query.startDate.trim() : "";
      const endDate = typeof req.query.endDate === "string" ? req.query.endDate.trim() : "";
      const entries = await readLedgerEntries();
      const tossRows = await fetchTossRows(startDate, endDate, limit);
      const report = buildTossJoinReport(entries, tossRows, limit);

      res.json({
        ok: true,
        filters: { startDate, endDate, limit },
        report,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "toss attribution join failed";
      res.status(500).json({ ok: false, error: "attribution_toss_join_error", message });
    }
  });

  router.post("/api/attribution/replay/toss", async (req: Request, res: Response) => {
    try {
      const startDate =
        typeof req.body?.startDate === "string"
          ? req.body.startDate.trim()
          : typeof req.query.startDate === "string"
            ? req.query.startDate.trim()
            : "";
      const endDate =
        typeof req.body?.endDate === "string"
          ? req.body.endDate.trim()
          : typeof req.query.endDate === "string"
            ? req.query.endDate.trim()
            : "";
      const limit = parsePositiveInt(
        typeof req.body?.limit === "number" ? String(req.body.limit) : req.query.limit,
        100,
        500,
      );
      const dryRun = parseBooleanish(req.body?.dryRun ?? req.query.dryRun, true);

      const [entries, tossRows] = await Promise.all([
        readLedgerEntries(),
        fetchTossRows(startDate, endDate, limit),
      ]);
      const replayPlan = buildTossReplayPlan(entries, tossRows, limit);

      if (!dryRun) {
        for (const entry of replayPlan.insertableEntries) {
          await appendLedgerEntry(entry);
        }
      }

      res.json({
        ok: true,
        dryRun,
        filters: { startDate, endDate, limit },
        summary: {
          ...replayPlan.summary,
          writtenRows: dryRun ? 0 : replayPlan.insertableEntries.length,
        },
        samples: {
          insertableEntries: replayPlan.insertableEntries.slice(0, 5),
          skippedRows: replayPlan.skippedRows.slice(0, 5),
        },
        notes: [
          "이 endpoint는 read-only 운영 DB의 tb_sales_toss를 읽어 replay용 payment_success row를 만든다.",
          "dryRun=true면 파일에 쓰지 않고 preview만 반환한다.",
          "replay row는 live 원인 확정용이 아니라 조인 plumbing 점검용이다.",
        ],
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "toss replay failed";
      res.status(500).json({ ok: false, error: "attribution_toss_replay_error", message });
    }
  });

  router.get("/api/attribution/hourly-compare", async (req: Request, res: Response) => {
    try {
      const date = resolveKstDate(req.query.date);
      const entries = await readLedgerEntries();
      const tossHourlyRows = await fetchTossHourlyRows(date);
      const items = buildAttributionHourlyCompare({
        date,
        ledgerEntries: entries,
        tossHourlyRows,
      });
      const receiverGapHours = items.filter(
        (item) => item.tossApprovalCount > 0 && item.paymentSuccessEntries === 0,
      ).length;

      res.json({
        ok: true,
        date,
        summary: {
          hours: items.length,
          tossApprovalCount: items.reduce((acc, item) => acc + item.tossApprovalCount, 0),
          paymentSuccessEntries: items.reduce((acc, item) => acc + item.paymentSuccessEntries, 0),
          checkoutEntries: items.reduce((acc, item) => acc + item.checkoutEntries, 0),
          receiverGapHours,
        },
        items,
        notes: [
          "시간대 기준은 Asia/Seoul(KST)로 맞췄다.",
          "이 리포트는 토스 승인 vs receiver row의 시간대 격차를 먼저 보는 초안이다.",
          "GA4 DebugView 검증 전, 어느 시간대에 receiver가 비는지 확인하는 용도로 쓴다.",
        ],
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "hourly attribution compare failed";
      res.status(500).json({ ok: false, error: "attribution_hourly_compare_error", message });
    }
  });

  return router;
};
