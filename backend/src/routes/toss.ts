/**
 * Toss Payments API 라우트
 * - 거래내역 조회 (transactions)
 * - 정산내역 조회 (settlements)
 * - orderId로 결제 상세 조회
 * - 일별 요약 집계
 */

import express, { type Request, type Response } from "express";
import { env } from "../env";
import { getCrmDb } from "../crmLocalDb";

const TOSS_BASE = "https://api.tosspayments.com";

function getTossAuth(): string | null {
  const key = env.TOSS_LIVE_SECRET_KEY?.trim();
  if (!key) return null;
  return `Basic ${Buffer.from(`${key}:`).toString("base64")}`;
}

async function tossGet<T>(path: string): Promise<T> {
  const auth = getTossAuth();
  if (!auth) throw new Error("TOSS_LIVE_SECRET_KEY 미설정");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(`${TOSS_BASE}${path}`, {
      headers: { Authorization: auth },
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Toss API ${res.status}: ${body.slice(0, 200)}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

type TossTransaction = {
  mId: string;
  transactionKey: string;
  paymentKey: string;
  orderId: string;
  method: string;
  status: string;
  transactionAt: string;
  currency: string;
  amount: number;
};

type TossSettlement = {
  mId: string;
  paymentKey: string;
  orderId: string;
  method: string;
  amount: number;
  fee: number;
  payOutAmount: number;
  soldDate: string;
  paidOutDate: string;
  approvedAt: string;
  card?: { issuerCode: string; acquirerCode: string; number: string; cardType: string; installmentPlanMonths: number };
  cancel?: unknown;
};

export const createTossRouter = () => {
  const router = express.Router();

  // 거래내역 조회
  router.get("/api/toss/transactions", async (req: Request, res: Response) => {
    try {
      const startDate = (req.query.startDate as string) || new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
      const endDate = (req.query.endDate as string) || new Date().toISOString().slice(0, 10);
      const limit = Math.min(Number(req.query.limit) || 100, 100);

      const data = await tossGet<TossTransaction[]>(
        `/v1/transactions?startDate=${startDate}&endDate=${endDate}&limit=${limit}`,
      );

      res.json({ ok: true, count: data.length, transactions: data });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "Toss API error" });
    }
  });

  // 정산내역 조회
  router.get("/api/toss/settlements", async (req: Request, res: Response) => {
    try {
      const startDate = (req.query.startDate as string) || new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
      const endDate = (req.query.endDate as string) || new Date().toISOString().slice(0, 10);
      const limit = Math.min(Number(req.query.limit) || 100, 100);

      const data = await tossGet<TossSettlement[]>(
        `/v1/settlements?startDate=${startDate}&endDate=${endDate}&limit=${limit}`,
      );

      res.json({ ok: true, count: data.length, settlements: data });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "Toss API error" });
    }
  });

  // orderId로 결제 상세 조회
  router.get("/api/toss/payments/orders/:orderId", async (req: Request, res: Response) => {
    try {
      const rawOrderId = req.params.orderId;
      const orderId = Array.isArray(rawOrderId) ? rawOrderId[0] : rawOrderId;
      const data = await tossGet<Record<string, unknown>>(
        `/v1/payments/orders/${encodeURIComponent(orderId)}`,
      );
      res.json({ ok: true, payment: data });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "Toss API error" });
    }
  });

  // 일별 요약 집계
  router.get("/api/toss/daily-summary", async (req: Request, res: Response) => {
    try {
      const startDate = (req.query.startDate as string) || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      const endDate = (req.query.endDate as string) || new Date().toISOString().slice(0, 10);

      const settlements = await tossGet<TossSettlement[]>(
        `/v1/settlements?startDate=${startDate}&endDate=${endDate}&limit=100`,
      );

      // 일별 집계
      const daily = new Map<string, { date: string; count: number; amount: number; fee: number; payout: number; cardCount: number; vaCount: number; cancelCount: number }>();

      for (const s of settlements) {
        const date = s.soldDate;
        const d = daily.get(date) ?? { date, count: 0, amount: 0, fee: 0, payout: 0, cardCount: 0, vaCount: 0, cancelCount: 0 };
        d.count++;
        d.amount += s.amount;
        d.fee += s.fee;
        d.payout += s.payOutAmount;
        if (s.method === "카드") d.cardCount++;
        if (s.method === "가상계좌") d.vaCount++;
        if (s.cancel) d.cancelCount++;
        daily.set(date, d);
      }

      const summary = Array.from(daily.values()).sort((a, b) => a.date.localeCompare(b.date));
      const totals = {
        totalCount: settlements.length,
        totalAmount: settlements.reduce((s, t) => s + t.amount, 0),
        totalFee: settlements.reduce((s, t) => s + t.fee, 0),
        totalPayout: settlements.reduce((s, t) => s + t.payOutAmount, 0),
        avgFeeRate: settlements.length > 0
          ? Number((settlements.reduce((s, t) => s + t.fee, 0) / Math.max(settlements.reduce((s, t) => s + t.amount, 0), 1) * 100).toFixed(2))
          : 0,
      };

      res.json({ ok: true, totals, daily: summary });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "Toss API error" });
    }
  });

  // Toss → 로컬 SQLite 동기화
  router.post("/api/toss/sync", async (req: Request, res: Response) => {
    try {
      const mode = (req.query.mode as string) || "incremental";
      const auth = getTossAuth();
      if (!auth) { res.status(503).json({ ok: false, error: "TOSS_LIVE_SECRET_KEY 미설정" }); return; }

      const db = getCrmDb();
      const insertTxn = db.prepare(`
        INSERT OR IGNORE INTO toss_transactions (transaction_key, payment_key, order_id, method, status, transaction_at, currency, amount, m_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const insertSettle = db.prepare(`
        INSERT OR IGNORE INTO toss_settlements (payment_key, order_id, method, amount, fee, pay_out_amount, sold_date, paid_out_date, approved_at, card_issuer, card_type, cancel_amount)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      // 기간 설정
      let startDate: string;
      if (mode === "backfill") {
        startDate = (req.query.startDate as string) || "2025-01-01";
      } else {
        // incremental: 어제부터
        const d = new Date(Date.now() - 2 * 86400000);
        startDate = d.toISOString().slice(0, 10);
      }
      const endDate = (req.query.endDate as string) || new Date().toISOString().slice(0, 10);

      let totalTxn = 0;
      let totalSettle = 0;
      const errors: string[] = [];

      // 월 단위로 반복
      const months: Array<{ start: string; end: string }> = [];
      const s = new Date(startDate);
      const e = new Date(endDate);
      while (s <= e) {
        const mStart = s.toISOString().slice(0, 10);
        s.setMonth(s.getMonth() + 1);
        s.setDate(0); // 이전 달 마지막 날
        const mEnd = s > e ? endDate : s.toISOString().slice(0, 10);
        months.push({ start: mStart, end: mEnd });
        s.setDate(s.getDate() + 1); // 다음 달 1일
      }

      for (const m of months) {
        // 거래내역 페이지네이션
        let lastKey: string | null = null;
        let page = 0;
        while (page < 50) { // 최대 50페이지 (5,000건/월)
          let url = `/v1/transactions?startDate=${m.start}&endDate=${m.end}&limit=100`;
          if (lastKey) url += `&startingAfter=${encodeURIComponent(lastKey)}`;

          try {
            const txns = await tossGet<TossTransaction[]>(url);
            for (const t of txns) {
              insertTxn.run(t.transactionKey, t.paymentKey, t.orderId, t.method, t.status, t.transactionAt, t.currency, t.amount, t.mId);
              totalTxn++;
            }
            if (txns.length < 100) break;
            lastKey = txns[txns.length - 1].transactionKey;
            page++;
            await new Promise((r) => setTimeout(r, 300)); // rate limit
          } catch (err) {
            errors.push(`txn ${m.start}: ${err instanceof Error ? err.message : "error"}`);
            break;
          }
        }

        // 정산내역 (페이지네이션 없이 100건씩)
        try {
          const settlements = await tossGet<TossSettlement[]>(
            `/v1/settlements?startDate=${m.start}&endDate=${m.end}&limit=100`,
          );
          for (const s of settlements) {
            insertSettle.run(
              s.paymentKey, s.orderId, s.method, s.amount, s.fee, s.payOutAmount,
              s.soldDate, s.paidOutDate, s.approvedAt,
              s.card?.issuerCode ?? null, s.card?.cardType ?? null,
              0,
            );
            totalSettle++;
          }
        } catch (err) {
          errors.push(`settle ${m.start}: ${err instanceof Error ? err.message : "error"}`);
        }

        await new Promise((r) => setTimeout(r, 500)); // 월 간격
      }

      // 결과 확인
      const stats = {
        transactions: (db.prepare("SELECT COUNT(*) as cnt FROM toss_transactions").get() as { cnt: number }).cnt,
        settlements: (db.prepare("SELECT COUNT(*) as cnt FROM toss_settlements").get() as { cnt: number }).cnt,
        earliestTxn: (db.prepare("SELECT MIN(transaction_at) as v FROM toss_transactions").get() as { v: string | null }).v,
        latestTxn: (db.prepare("SELECT MAX(transaction_at) as v FROM toss_transactions").get() as { v: string | null }).v,
      };

      res.json({
        ok: true,
        mode,
        range: { startDate, endDate },
        monthsProcessed: months.length,
        inserted: { transactions: totalTxn, settlements: totalSettle },
        dbTotals: stats,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "Sync failed" });
    }
  });

  // 로컬 DB Toss 통계
  router.get("/api/toss/local-stats", (_req: Request, res: Response) => {
    try {
      const db = getCrmDb();
      const txn = db.prepare("SELECT COUNT(*) as cnt, MIN(transaction_at) as earliest, MAX(transaction_at) as latest FROM toss_transactions").get() as { cnt: number; earliest: string | null; latest: string | null };
      const settle = db.prepare("SELECT COUNT(*) as cnt, SUM(amount) as totalAmt, SUM(fee) as totalFee, SUM(pay_out_amount) as totalPayout FROM toss_settlements").get() as { cnt: number; totalAmt: number; totalFee: number; totalPayout: number };
      res.json({
        ok: true,
        transactions: { count: txn.cnt, earliest: txn.earliest, latest: txn.latest },
        settlements: { count: settle.cnt, totalAmount: settle.totalAmt, totalFee: settle.totalFee, totalPayout: settle.totalPayout },
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "error" });
    }
  });

  return router;
};
