import { env } from "../env";
import { syncMetaConversionsFromLedger } from "../metaCapi";
import {
  getCachedResult,
  runPageSpeedTest,
  setCachedResult,
  type PageSpeedStrategy,
} from "../pagespeed";
import { syncAttributionPaymentStatusesFromToss } from "../routes/attribution";
import { persistPageSpeedResult } from "../routes/pagespeed";

export const startBackgroundJobs = () => {
  if (env.PAGESPEED_API_KEY) {
    const autoCwvUrls = ["https://biocom.kr"];
    const autoCwvStrategies: PageSpeedStrategy[] = ["mobile", "desktop"];

    setTimeout(async () => {
      // eslint-disable-next-line no-console
      console.log("[CWV auto] start -", autoCwvUrls.join(", "));

      for (const url of autoCwvUrls) {
        for (const strategy of autoCwvStrategies) {
          if (getCachedResult(url, strategy)) {
            // eslint-disable-next-line no-console
            console.log(`[CWV auto] cache hit, skip: ${strategy}:${url}`);
            continue;
          }

          try {
            const result = await runPageSpeedTest(url, strategy);
            setCachedResult(result);
            await persistPageSpeedResult(result);
            // eslint-disable-next-line no-console
            console.log(`[CWV auto] ok ${strategy}:${url} - Performance: ${result.performanceScore}`);
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error(
              `[CWV auto] fail ${strategy}:${url}:`,
              error instanceof Error ? error.message : error,
            );
          }
        }
      }

      // eslint-disable-next-line no-console
      console.log("[CWV auto] done");
    }, 30_000);
  }

  const capiSyncIntervalMs = 30 * 60 * 1000;
  const capiSyncLimit = 100;
  const attributionStatusSyncIntervalMs = 15 * 60 * 1000;
  const attributionStatusSyncLimit = 100;

  const runCapiSync = async () => {
    try {
      const result = await syncMetaConversionsFromLedger({ limit: capiSyncLimit });
      if (result.sent > 0) {
        // eslint-disable-next-line no-console
        console.log(`[CAPI auto-sync] ${result.sent}건 전송 (건너뜀 ${result.skipped}, 실패 ${result.failed})`);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[CAPI auto-sync] 오류:", error instanceof Error ? error.message : error);
    }
  };

  const runAttributionStatusSync = async () => {
    try {
      const result = await syncAttributionPaymentStatusesFromToss({
        limit: attributionStatusSyncLimit,
        dryRun: false,
      });
      if (result.writtenRows > 0) {
        // eslint-disable-next-line no-console
        console.log(
          `[Attribution status sync] ${result.writtenRows}건 갱신 (후보 ${result.totalCandidates}, 대기 유지 ${result.skippedPendingRows}, 미매칭 ${result.skippedNoMatchRows})`,
        );
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(
        "[Attribution status sync] 오류:",
        error instanceof Error ? error.message : error,
      );
    }
  };

  setTimeout(() => {
    runAttributionStatusSync();
    setInterval(runAttributionStatusSync, attributionStatusSyncIntervalMs);
    // eslint-disable-next-line no-console
    console.log(`[Attribution status sync] 활성화 — ${attributionStatusSyncIntervalMs / 60000}분 주기`);
  }, 90_000);

  setTimeout(() => {
    runCapiSync();
    setInterval(runCapiSync, capiSyncIntervalMs);
    // eslint-disable-next-line no-console
    console.log(`[CAPI auto-sync] 활성화 — ${capiSyncIntervalMs / 60000}분 주기`);
  }, 60_000);
};
