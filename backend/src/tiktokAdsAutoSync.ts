import { ingestTikTokDaily, isoDateOnly, yesterdayKstDate } from "./tiktokAdsDailySync";
import { getDailyTableState } from "./tiktokRoasComparison";

const MIN_AUTO_BACKFILL_START = "2026-04-18";

export type EnsureCoverageResult = {
  attempted: boolean;
  ok: boolean;
  message: string | null;
  startDate: string | null;
  endDate: string | null;
  rows: number | null;
  fetchedAt: string | null;
};

const addDays = (yyyyMmDd: string, days: number) => {
  const parsed = new Date(`${yyyyMmDd}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return isoDateOnly(parsed);
};

const minDate = (left: string, right: string) => (left < right ? left : right);
const maxDate = (left: string, right: string) => (left > right ? left : right);

let inFlight: Promise<EnsureCoverageResult> | null = null;

const performIngest = async (startDate: string, endDate: string): Promise<EnsureCoverageResult> => {
  const accessToken = process.env.TIKTOK_BUSINESS_ACCESS_TOKEN;
  const advertiserId = process.env.TIKTOK_ADVERTISER_ID;
  if (!accessToken || !advertiserId) {
    return {
      attempted: true,
      ok: false,
      message: "TIKTOK_BUSINESS_ACCESS_TOKEN/TIKTOK_ADVERTISER_ID 미설정으로 자동 적재 건너뜀",
      startDate,
      endDate,
      rows: null,
      fetchedAt: null,
    };
  }

  try {
    const result = await ingestTikTokDaily({ startDate, endDate, accessToken, advertiserId });
    return {
      attempted: true,
      ok: true,
      message: `${startDate} ~ ${endDate} 자동 적재 ${result.rows}행`,
      startDate,
      endDate,
      rows: result.rows,
      fetchedAt: result.fetchedAt,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "TikTok daily auto ingest failed";
    return {
      attempted: true,
      ok: false,
      message,
      startDate,
      endDate,
      rows: null,
      fetchedAt: null,
    };
  }
};

const computeMissingRange = (requestedEnd: string) => {
  const yesterday = yesterdayKstDate();
  const targetEnd = minDate(requestedEnd, yesterday);
  if (targetEnd < MIN_AUTO_BACKFILL_START) {
    return null;
  }

  const state = getDailyTableState();
  const fallbackStart = maxDate(MIN_AUTO_BACKFILL_START, addDays(targetEnd, -6));
  if (!state.maxDate) {
    return { startDate: fallbackStart, endDate: targetEnd };
  }

  if (state.maxDate >= targetEnd) {
    return null;
  }

  const startDate = maxDate(MIN_AUTO_BACKFILL_START, addDays(state.maxDate, 1));
  return { startDate, endDate: targetEnd };
};

export const ensureTikTokDailyCovers = async (
  _requestedStart: string,
  requestedEnd: string,
): Promise<EnsureCoverageResult> => {
  const range = computeMissingRange(requestedEnd);
  if (!range) {
    return {
      attempted: false,
      ok: true,
      message: null,
      startDate: null,
      endDate: null,
      rows: null,
      fetchedAt: null,
    };
  }

  if (inFlight) return inFlight;

  inFlight = performIngest(range.startDate, range.endDate).finally(() => {
    inFlight = null;
  });
  return inFlight;
};

export const ensureTikTokDailyUpToYesterday = async (): Promise<EnsureCoverageResult> => {
  const yesterday = yesterdayKstDate();
  return ensureTikTokDailyCovers(MIN_AUTO_BACKFILL_START, yesterday);
};
