/**
 * 광고 플랫폼별 진짜 ROAS (same-window) 공통 endpoint.
 * evidence-join script 를 광고 spend window 와 같은 since~until 로 실행해서
 * 해당 채널 (paid_meta / paid_tiktok / paid_google / paid_naver) 내부 매출을 반환.
 *
 * 운영DB write 금지 · 외부 전송 금지 — read-only.
 */

import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

import { Router, type Request, type Response } from "express";

const execFileAsync = promisify(execFile);
const BACKEND_ROOT = path.resolve(__dirname, "..", "..");
const TSX_BIN = path.resolve(BACKEND_ROOT, "node_modules", ".bin", "tsx");
const EVIDENCE_SCRIPT = "scripts/monthly-evidence-join-dry-run.ts";
const EVIDENCE_TIMEOUT_MS = 90_000;
const EVIDENCE_JOIN_ENABLED = process.env.INTERNAL_REAL_ROAS_EVIDENCE_JOIN_ENABLED === "1";

type EvidencePayload = {
  metadata: { dateStart: string; dateEndExclusive: string; month: string };
  channelSummary: Array<{ primaryChannel: string; orders: number; revenue: number; confidence: Record<string, number> }>;
};

const ALLOWED_PLATFORMS = ["paid_meta", "paid_tiktok", "paid_google", "paid_naver"] as const;
type Platform = (typeof ALLOWED_PLATFORMS)[number];

const round2 = (n: number) => Math.round(n * 100) / 100;
const fmtKrw = (n: number): string => {
  if (n === 0) return "₩0";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 100_000_000) {
    const eok = Math.floor(abs / 100_000_000);
    const man = Math.round((abs % 100_000_000) / 10_000);
    return `${sign}₩${eok}억${man ? ` ${man.toLocaleString("ko-KR")}만` : ""}`;
  }
  if (abs >= 10_000) {
    const man = Math.round(abs / 10_000);
    return `${sign}₩${man.toLocaleString("ko-KR")}만`;
  }
  return `${sign}₩${abs.toLocaleString("ko-KR")}`;
};

const runEvidenceJoin = async (site: string, since: string, until: string): Promise<EvidencePayload> => {
  const nodeBinDir = path.dirname(process.execPath);
  const mergedPath = [nodeBinDir, process.env.PATH || ""].filter(Boolean).join(path.delimiter);
  const { stdout } = await execFileAsync(
    process.execPath,
    [TSX_BIN, EVIDENCE_SCRIPT, `--site=${site}`, `--since=${since}`, `--until=${until}`, "--json"],
    {
      cwd: BACKEND_ROOT,
      timeout: EVIDENCE_TIMEOUT_MS,
      maxBuffer: 25 * 1024 * 1024,
      env: {
        ...process.env,
        PATH: mergedPath,
        BACKGROUND_JOBS_ENABLED: "false",
        SCHEDULED_SEND_ENABLED: "false",
      },
    },
  );
  return JSON.parse(stdout) as EvidencePayload;
};

// in-memory cache: key = `${site}|${since}|${until}` → 5분 TTL
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { ts: number; payload: EvidencePayload }>();
const inFlight = new Map<string, Promise<EvidencePayload>>();

const getEvidenceCached = async (site: string, since: string, until: string): Promise<EvidencePayload> => {
  const key = `${site}|${since}|${until}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.payload;
  const existing = inFlight.get(key);
  if (existing) return existing;
  const promise = runEvidenceJoin(site, since, until)
    .then((payload) => {
      cache.set(key, { ts: Date.now(), payload });
      return payload;
    })
    .finally(() => {
      inFlight.delete(key);
    });
  inFlight.set(key, promise);
  return promise;
};

const parsePlatform = (value: unknown): Platform | null => {
  if (typeof value !== "string") return null;
  return (ALLOWED_PLATFORMS as readonly string[]).includes(value) ? (value as Platform) : null;
};

const isYmd = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

export const createAdsInternalRoasRouter = () => {
  const router = Router();

  router.get("/api/ads/internal-real-roas", async (req: Request, res: Response) => {
    try {
      const platform = parsePlatform(req.query.platform);
      if (!platform) {
        res.status(400).json({ ok: false, error: "platform_required", allowed: ALLOWED_PLATFORMS });
        return;
      }
      const since = typeof req.query.since === "string" ? req.query.since : "";
      const until = typeof req.query.until === "string" ? req.query.until : "";
      if (!isYmd(since) || !isYmd(until)) {
        res.status(400).json({ ok: false, error: "since_until_must_be_YYYY-MM-DD" });
        return;
      }
      if (since > until) {
        res.status(400).json({ ok: false, error: "since_must_be_lte_until" });
        return;
      }
      const siteRaw = typeof req.query.site === "string" ? req.query.site : "biocom";
      const site = siteRaw === "biocom" ? "biocom" : "biocom"; // v0.1 biocom only

      const optionalSpend = typeof req.query.spend_krw === "string" ? Number(req.query.spend_krw) : null;
      const spendKrw = optionalSpend != null && Number.isFinite(optionalSpend) && optionalSpend >= 0 ? optionalSpend : null;

      if (!EVIDENCE_JOIN_ENABLED) {
        res.json({
          ok: false,
          mode: "read_only",
          site,
          platform,
          window: { since, until },
          spend_krw: spendKrw,
          spend_korean: spendKrw != null ? fmtKrw(spendKrw) : null,
          error: "internal_real_roas_evidence_join_disabled",
          message: "Heavy evidence-join is disabled for request-path safety. /ads uses site-summary confirmed ROAS.",
          degraded: true,
          invariants_held: {
            operational_db_write: 0,
            external_send_count: 0,
            ads_platform_state_change: 0,
          },
        });
        return;
      }

      const evidence = await getEvidenceCached(site, since, until);
      const row = (evidence.channelSummary || []).find((r) => r.primaryChannel === platform);
      const internalRevenue = row?.revenue ?? 0;
      const internalOrders = row?.orders ?? 0;
      const realRoas = spendKrw != null && spendKrw > 0 ? round2(internalRevenue / spendKrw) : null;

      res.json({
        ok: true,
        mode: "read_only",
        site,
        platform,
        window: { since, until },
        internal: {
          revenue_krw: internalRevenue,
          revenue_korean: fmtKrw(internalRevenue),
          orders: internalOrders,
          source: `evidence-join ${platform} channel (NaPm/click_id/paid UTM/referrer · 광고비와 동일 since~until 윈도우)`,
        },
        spend_krw: spendKrw,
        spend_korean: spendKrw != null ? fmtKrw(spendKrw) : null,
        internal_real_roas: realRoas,
        evidence_meta: {
          date_start: evidence.metadata.dateStart,
          date_end_exclusive: evidence.metadata.dateEndExclusive,
        },
        invariants_held: {
          operational_db_write: 0,
          external_send_count: 0,
          ads_platform_state_change: 0,
        },
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "internal_real_roas_failed";
      res.status(500).json({ ok: false, error: "internal_real_roas_error", message: msg.slice(0, 200) });
    }
  });

  return router;
};
