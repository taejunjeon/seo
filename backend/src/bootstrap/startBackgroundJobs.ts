import { env } from "../env";
import { sendAligo, sendAligoSms } from "../aligo";
import {
  canArchiveGroup,
  claimDueScheduledSends,
  deleteCustomerGroup,
  finishScheduledSend,
  getCrmDb,
  listArchivedCustomerGroupsForCleanup,
  listGroupMembers,
  recordMessage,
  type CustomerGroupMember,
  type ScheduledSendRow,
} from "../crmLocalDb";
import { evaluateForEnforcement, type ContactPolicyEnforcementResult, type EnforcementSeverity } from "../contactPolicy";
import { syncMetaConversionsFromLedger } from "../metaCapi";
import { ensureTikTokDailyUpToYesterday } from "../tiktokAdsAutoSync";
import { log, obsEvents } from "../obs";
import {
  getCachedResult,
  runPageSpeedTest,
  setCachedResult,
  type PageSpeedStrategy,
} from "../pagespeed";
import { syncAttributionPaymentStatusesFromToss } from "../routes/attribution";
import { persistPageSpeedResult } from "../routes/pagespeed";
import { readLedgerEntries, readLedgerEntriesInRange } from "../attribution";
import { readMetaCapiSendLogs } from "../metaCapi";
import { readPaymentDecisionMeasurements } from "../paymentDecisionLatency";
import { startFunnelHealthPrecomputeWorker } from "../funnelHealthPrecompute";
import { startLeadingIndicatorsPrecomputeWorker } from "../leadingIndicators";
import { startAcquisitionPrecomputeWorker } from "../acquisitionPrecompute";
import { fetchRemoteLedgerEntriesForAcquisition } from "../routes/attribution";
import { startCallpricePrecomputeWorker } from "../callpricePrecompute";
import { startNaverAdsSummaryPrecomputeWorker } from "../naverAdsSummaryPrecompute";

export const startBackgroundJobs = () => {
  if (!env.BACKGROUND_JOBS_ENABLED) {
    // eslint-disable-next-line no-console
    console.log("[Background jobs] disabled by BACKGROUND_JOBS_ENABLED=0");
    return;
  }

  if (env.CWV_AUTO_SYNC_ENABLED && env.PAGESPEED_API_KEY) {
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

  const capiSyncIntervalMs = env.CAPI_AUTO_SYNC_INTERVAL_MS;
  const capiSyncLimit = env.CAPI_AUTO_SYNC_LIMIT;
  const attributionStatusSyncIntervalMs = env.ATTRIBUTION_STATUS_SYNC_INTERVAL_MS;
  const attributionStatusSyncLimit = env.ATTRIBUTION_STATUS_SYNC_LIMIT;
  const imwebAutoSyncIntervalMs = env.IMWEB_AUTO_SYNC_INTERVAL_MS;
  const imwebAutoSyncMaxPage = env.IMWEB_AUTO_SYNC_MAX_PAGE;
  const tossAutoSyncIntervalMs = env.TOSS_AUTO_SYNC_INTERVAL_MS;
  const tossAutoSyncWindowHours = env.TOSS_AUTO_SYNC_WINDOW_HOURS;
  const scheduledSendPollMs = env.SCHEDULED_SEND_POLL_MS;

  // Self-call base URL — pm2 single instance 에서 같은 프로세스 express 서버로 HTTP 호출
  const selfBaseUrl = `http://127.0.0.1:${env.PORT}`;

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

  // imweb 주문 증분 sync — 15분 주기. 두 사이트(biocom, thecleancoffee) 순차 호출.
  // 기존 POST /api/crm-local/imweb/sync-orders 엔드포인트를 self-call 로 재사용 → 로직 중복 없음.
  const runImwebOrdersSync = async () => {
    const sites = ["biocom", "thecleancoffee"] as const;
    for (const site of sites) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 90_000);
        const response = await fetch(`${selfBaseUrl}/api/crm-local/imweb/sync-orders`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ site, maxPage: imwebAutoSyncMaxPage }),
          signal: controller.signal,
        });
        clearTimeout(timer);
        const body = (await response.json().catch(() => null)) as
          | { ok?: boolean; synced?: number; sites?: Array<{ site: string; synced: number; totalCount: number; error: string | null }> }
          | null;
        if (response.ok && body?.ok) {
          const siteResult = body.sites?.find((s) => s.site === site);
          // eslint-disable-next-line no-console
          console.log(
            `[Imweb orders sync] ${site} — upsert ${siteResult?.synced ?? body.synced ?? 0} (totalCount ${siteResult?.totalCount ?? "?"})`,
          );
        } else {
          // eslint-disable-next-line no-console
          console.error(`[Imweb orders sync] ${site} 실패: HTTP ${response.status}`);
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(
          `[Imweb orders sync] ${site} 오류:`,
          error instanceof Error ? error.message : error,
        );
      }
    }
  };

  // Toss settlements 증분 sync — 15분 주기. biocom / coffee 순차.
  const runTossSettlementsSync = async () => {
    const stores = ["biocom", "thecleancoffee"] as const;
    for (const store of stores) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 90_000);
        const url = new URL(`${selfBaseUrl}/api/toss/sync`);
        url.searchParams.set("store", store);
        url.searchParams.set("mode", "incremental");
        url.searchParams.set("windowHours", String(tossAutoSyncWindowHours));
        const response = await fetch(url.toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
        });
        clearTimeout(timer);
        const body = (await response.json().catch(() => null)) as
          | {
              ok?: boolean;
              inserted?: { transactions: number; settlements: number };
              range?: { startDate: string; endDate: string };
            }
          | null;
        if (response.ok && body?.ok) {
          const inserted = body.inserted;
          const added = (inserted?.transactions ?? 0) + (inserted?.settlements ?? 0);
          if (added > 0) {
            // eslint-disable-next-line no-console
            console.log(
              `[Toss settlements sync] ${store} — tx ${inserted?.transactions ?? 0} / settle ${inserted?.settlements ?? 0} (range ${body.range?.startDate ?? "?"}~${body.range?.endDate ?? "?"})`,
            );
          }
        } else {
          // eslint-disable-next-line no-console
          console.error(`[Toss settlements sync] ${store} 실패: HTTP ${response.status}`);
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(
          `[Toss settlements sync] ${store} 오류:`,
          error instanceof Error ? error.message : error,
        );
      }
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

  if (env.ATTRIBUTION_STATUS_SYNC_ENABLED) {
    setTimeout(() => {
      runAttributionStatusSync();
      setInterval(runAttributionStatusSync, attributionStatusSyncIntervalMs);
      // eslint-disable-next-line no-console
      console.log(`[Attribution status sync] 활성화 — ${attributionStatusSyncIntervalMs / 60000}분 주기`);
    }, 90_000);
  } else {
    // eslint-disable-next-line no-console
    console.log("[Attribution status sync] disabled by ATTRIBUTION_STATUS_SYNC_ENABLED=0");
  }

  if (env.CAPI_AUTO_SYNC_ENABLED) {
    setTimeout(() => {
      runCapiSync();
      setInterval(runCapiSync, capiSyncIntervalMs);
      // eslint-disable-next-line no-console
      console.log(`[CAPI auto-sync] 활성화 — ${capiSyncIntervalMs / 60000}분 주기`);
    }, 60_000);
  } else {
    // eslint-disable-next-line no-console
    console.log("[CAPI auto-sync] disabled by CAPI_AUTO_SYNC_ENABLED=0");
  }

  // Imweb 주문 증분 sync — 다른 job 과 tick 겹치지 않도록 +3분 offset (180s)
  if (env.IMWEB_AUTO_SYNC_ENABLED) {
    setTimeout(() => {
      runImwebOrdersSync();
      setInterval(runImwebOrdersSync, imwebAutoSyncIntervalMs);
      // eslint-disable-next-line no-console
      console.log(
        `[Imweb orders sync] 활성화 — ${imwebAutoSyncIntervalMs / 60000}분 주기, maxPage=${imwebAutoSyncMaxPage}`,
      );
    }, 180_000);
  } else {
    // eslint-disable-next-line no-console
    console.log("[Imweb orders sync] disabled by IMWEB_AUTO_SYNC_ENABLED=0");
  }

  // Toss settlements 증분 sync — +8분 offset (480s), imweb 과 5분 간격
  if (env.TOSS_AUTO_SYNC_ENABLED) {
    setTimeout(() => {
      runTossSettlementsSync();
      setInterval(runTossSettlementsSync, tossAutoSyncIntervalMs);
      // eslint-disable-next-line no-console
      console.log(
        `[Toss settlements sync] 활성화 — ${tossAutoSyncIntervalMs / 60000}분 주기, windowHours=${tossAutoSyncWindowHours}`,
      );
    }, 480_000);
  } else {
    // eslint-disable-next-line no-console
    console.log("[Toss settlements sync] disabled by TOSS_AUTO_SYNC_ENABLED=0");
  }

  if (env.TIKTOK_ADS_AUTO_SYNC_ENABLED && process.env.TIKTOK_BUSINESS_ACCESS_TOKEN && process.env.TIKTOK_ADVERTISER_ID) {
    const tiktokIntervalMs = env.TIKTOK_ADS_AUTO_SYNC_INTERVAL_MS;
    let tiktokRunning = false;
    const runTikTokDailySync = async () => {
      if (tiktokRunning) return;
      tiktokRunning = true;
      try {
        const result = await ensureTikTokDailyUpToYesterday();
        if (result.attempted) {
          // eslint-disable-next-line no-console
          console.log(
            `[TikTok daily sync] ${result.ok ? "ok" : "fail"} ${result.startDate}~${result.endDate} rows=${result.rows ?? "-"} ${result.message ?? ""}`,
          );
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("[TikTok daily sync] 오류:", error instanceof Error ? error.message : error);
      } finally {
        tiktokRunning = false;
      }
    };
    setTimeout(() => {
      void runTikTokDailySync();
      setInterval(() => { void runTikTokDailySync(); }, tiktokIntervalMs);
      // eslint-disable-next-line no-console
      console.log(`[TikTok daily sync] 활성화 — ${tiktokIntervalMs / 60000}분 주기`);
    }, 600_000);
  } else {
    // eslint-disable-next-line no-console
    console.log("[TikTok daily sync] disabled (TIKTOK_ADS_AUTO_SYNC_ENABLED=0 또는 TikTok env 누락)");
  }

  if (env.SCHEDULED_SEND_ENABLED) {
    recoverStuckScheduledSends();
    let scheduledSendRunning = false;
    const runScheduledSends = async () => {
      if (scheduledSendRunning) return;
      scheduledSendRunning = true;
      try {
        const rows = claimDueScheduledSends(new Date().toISOString());
        for (const row of rows) {
          await processScheduledSend(row);
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("[Scheduled send] poll error:", error instanceof Error ? error.message : error);
      } finally {
        scheduledSendRunning = false;
      }
    };

    setTimeout(() => {
      runScheduledSends();
      setInterval(runScheduledSends, scheduledSendPollMs);
      // eslint-disable-next-line no-console
      console.log(`[Scheduled send] 활성화 — ${scheduledSendPollMs / 1000}초 주기`);
    }, 10_000);
  } else {
    // eslint-disable-next-line no-console
    console.log("[Scheduled send] disabled by SCHEDULED_SEND_ENABLED=false");
  }

  if (env.TEMP_GROUP_CLEANUP_ENABLED) {
    scheduleTempGroupCleanup();
  } else {
    // eslint-disable-next-line no-console
    console.log("[Temp group cleanup] disabled by TEMP_GROUP_CLEANUP_ENABLED=false");
  }

  // funnel-health precompute (Option B):
  // 5분마다 site × window 조합 미리 계산해 두면 frontend 요청은 cache read 만 (< 50ms).
  // 환경변수로 끌 수 있게: FUNNEL_HEALTH_PRECOMPUTE_ENABLED=0 / FUNNEL_HEALTH_PRECOMPUTE_INTERVAL_MS=300000
  const funnelPrecomputeEnabled = process.env.FUNNEL_HEALTH_PRECOMPUTE_ENABLED !== "0";
  const funnelPrecomputeIntervalMs = Number(process.env.FUNNEL_HEALTH_PRECOMPUTE_INTERVAL_MS ?? "300000");
  if (funnelPrecomputeEnabled && Number.isFinite(funnelPrecomputeIntervalMs) && funnelPrecomputeIntervalMs >= 60000) {
    startFunnelHealthPrecomputeWorker(async () => {
      // funnel-health 최대 window 가 30d 라 ledger 도 30d 만 가져오면 충분.
      // SQLite 인덱스로 range query → 전체 ledger read 보다 5~10배 빠르고 mem 부담 ↓
      const nowMs = Date.now();
      const fromMs = nowMs - 31 * 24 * 60 * 60 * 1000; // 30d + 1d 여유
      const ledgerEntries = await readLedgerEntriesInRange({
        loggedAtFromIso: new Date(fromMs).toISOString(),
      });
      const capiLogs = await readMetaCapiSendLogs();
      const paymentDecisionRecords = readPaymentDecisionMeasurements(
        nowMs - 30 * 24 * 60 * 60 * 1000,
        nowMs,
      );
      return { ledgerEntries, capiLogs, paymentDecisionRecords };
    }, funnelPrecomputeIntervalMs);
    // eslint-disable-next-line no-console
    console.log(
      `[funnel-health precompute] 활성화 — ${Math.round(funnelPrecomputeIntervalMs / 60000)}분 주기 (8개 site×window 조합 미리 계산)`,
    );
  } else {
    // eslint-disable-next-line no-console
    console.log("[funnel-health precompute] disabled by FUNNEL_HEALTH_PRECOMPUTE_ENABLED=0 또는 interval<60s");
  }

  // leading-indicators precompute (P1 skeleton):
  // 화면은 aggregate cache 만 읽고, row-level key 는 API 응답에 노출하지 않는다.
  // hammer 방지를 위해 명시적으로 켠 경우에만 작동한다.
  // 환경변수: LEADING_INDICATORS_PRECOMPUTE_ENABLED=1 / LEADING_INDICATORS_PRECOMPUTE_INTERVAL_MS=1800000
  const leadingIndicatorsPrecomputeEnabled =
    process.env.LEADING_INDICATORS_PRECOMPUTE_ENABLED === "1" ||
    process.env.LEADING_INDICATORS_PRECOMPUTE_ENABLED === "true";
  const leadingIndicatorsPrecomputeIntervalMs = Number(
    process.env.LEADING_INDICATORS_PRECOMPUTE_INTERVAL_MS ?? "1800000",
  );
  if (
    leadingIndicatorsPrecomputeEnabled &&
    Number.isFinite(leadingIndicatorsPrecomputeIntervalMs) &&
    leadingIndicatorsPrecomputeIntervalMs >= 300000
  ) {
    startLeadingIndicatorsPrecomputeWorker(async () => {
      const nowMs = Date.now();
      const fromMs = nowMs - 31 * 24 * 60 * 60 * 1000;
      const ledgerEntries = await readLedgerEntriesInRange({
        loggedAtFromIso: new Date(fromMs).toISOString(),
      });
      return { ledgerEntries };
    }, leadingIndicatorsPrecomputeIntervalMs);
    // eslint-disable-next-line no-console
    console.log(
      `[leading-indicators precompute] 활성화 — ${Math.round(leadingIndicatorsPrecomputeIntervalMs / 60000)}분 주기 (site×window×channel×dimension 주요 조합 사전 계산)`,
    );
  } else {
    // eslint-disable-next-line no-console
    console.log("[leading-indicators precompute] disabled by LEADING_INDICATORS_PRECOMPUTE_ENABLED!=1 또는 interval<300s");
  }

  // acquisition precompute (Option B 확장):
  // /api/attribution/cohort-ltr, channel-category-repeat, reverse-funnel 3개 endpoint 가
  // 같은 cohort ledger 를 사용 → ledger 1회 load 후 4 window × 3 endpoint = 12 cache.
  // 환경변수: ACQUISITION_PRECOMPUTE_ENABLED, ACQUISITION_PRECOMPUTE_INTERVAL_MS
  const acquisitionPrecomputeEnabled =
    process.env.ACQUISITION_PRECOMPUTE_ENABLED === "1" ||
    process.env.ACQUISITION_PRECOMPUTE_ENABLED === "true";
  const acquisitionPrecomputeIntervalMs = Number(
    process.env.ACQUISITION_PRECOMPUTE_INTERVAL_MS ?? "300000",
  );
  if (
    acquisitionPrecomputeEnabled &&
    Number.isFinite(acquisitionPrecomputeIntervalMs) &&
    acquisitionPrecomputeIntervalMs >= 60000
  ) {
    startAcquisitionPrecomputeWorker(async () => {
      const remote = await fetchRemoteLedgerEntriesForAcquisition();
      return {
        ledgerEntries: remote.entries,
        dataSource: "operational_vm_ledger",
        remoteWarnings: remote.warnings,
      };
    }, acquisitionPrecomputeIntervalMs);
    // eslint-disable-next-line no-console
    console.log(
      `[acquisition precompute] 활성화 — ${Math.round(acquisitionPrecomputeIntervalMs / 60000)}분 주기 (4 window × 3 endpoint = 12 조합)`,
    );
  } else {
    // eslint-disable-next-line no-console
    console.log("[acquisition precompute] disabled by ACQUISITION_PRECOMPUTE_ENABLED!=1 또는 interval<60s");
  }

  // callprice (상담사 가치 분석) precompute:
  // /callprice 페이지가 14 endpoint 를 동시 호출 → 운영DB join 쿼리로 매 5~10s+ 대기.
  // 5분 주기로 default 조합 (시작일 2024-04-01 ~ 오늘, maturity 90/180/365) 을 self-fetch 로 채워둠.
  // 환경변수: CALLPRICE_PRECOMPUTE_ENABLED=0 / CALLPRICE_PRECOMPUTE_INTERVAL_MS
  const callpricePrecomputeEnabled = process.env.CALLPRICE_PRECOMPUTE_ENABLED !== "0";
  const callpricePrecomputeIntervalMs = Number(
    process.env.CALLPRICE_PRECOMPUTE_INTERVAL_MS ?? "300000",
  );
  if (
    callpricePrecomputeEnabled
    && Number.isFinite(callpricePrecomputeIntervalMs)
    && callpricePrecomputeIntervalMs >= 60000
  ) {
    startCallpricePrecomputeWorker(callpricePrecomputeIntervalMs);
    // eslint-disable-next-line no-console
    console.log(
      `[callprice precompute] 활성화 — ${Math.round(callpricePrecomputeIntervalMs / 60000)}분 주기 (14 endpoint default 조합 미리 계산)`,
    );
  } else {
    // eslint-disable-next-line no-console
    console.log("[callprice precompute] disabled by CALLPRICE_PRECOMPUTE_ENABLED=0 또는 interval<60s");
  }

  // Naver Ads campaign-summary precompute:
  // /ads/naver 첫 화면에서 evidence join 을 매번 돌리지 않도록 7/30/90일 기본 조합을 미리 계산한다.
  // self-fetch 로 route lazy cache 만 채우며, 광고 플랫폼 send/write 는 없다.
  // 환경변수: NAVER_ADS_SUMMARY_PRECOMPUTE_ENABLED=0 / NAVER_ADS_SUMMARY_PRECOMPUTE_INTERVAL_MS
  const naverAdsSummaryPrecomputeEnabled = process.env.NAVER_ADS_SUMMARY_PRECOMPUTE_ENABLED !== "0";
  const naverAdsSummaryPrecomputeIntervalMs = Number(
    process.env.NAVER_ADS_SUMMARY_PRECOMPUTE_INTERVAL_MS ?? "900000",
  );
  if (
    naverAdsSummaryPrecomputeEnabled
    && Number.isFinite(naverAdsSummaryPrecomputeIntervalMs)
    && naverAdsSummaryPrecomputeIntervalMs >= 60000
  ) {
    startNaverAdsSummaryPrecomputeWorker(naverAdsSummaryPrecomputeIntervalMs);
    // eslint-disable-next-line no-console
    console.log(
      `[Naver Ads summary precompute] 활성화 — ${Math.round(naverAdsSummaryPrecomputeIntervalMs / 60000)}분 주기 (site×7/30/90d 기본 조합)`,
    );
  } else {
    // eslint-disable-next-line no-console
    console.log("[Naver Ads summary precompute] disabled by NAVER_ADS_SUMMARY_PRECOMPUTE_ENABLED=0 또는 interval<60s");
  }

  // ROAS summary precompute:
  // 기본 화면은 어제 확정 데이터를 즉시 보여주고, 당일 데이터는 4시간 단위로만 갱신한다.
  // 사용자가 버튼을 눌렀을 때도 사전 계산된 today cache 를 먼저 읽게 해 Meta API hammer 를 막는다.
  const roasSummaryPrecomputeEnabled = process.env.ROAS_SUMMARY_PRECOMPUTE_ENABLED !== "0";
  const roasSummaryPrecomputeIntervalMs = Number(
    process.env.ROAS_SUMMARY_PRECOMPUTE_INTERVAL_MS ?? "14400000",
  );
  const roasSummaryPrecomputeStartDelayMs = Number(
    process.env.ROAS_SUMMARY_PRECOMPUTE_START_DELAY_MS ?? "90000",
  );
  const roasSummaryPrecomputeTimeoutMs = Number(
    process.env.ROAS_SUMMARY_PRECOMPUTE_TIMEOUT_MS ?? "80000",
  );
  const roasSummaryPrecomputeTargets = (
    process.env.ROAS_SUMMARY_PRECOMPUTE_TARGETS
      ?? "act_3138805896402376,act_654671961007474"
  )
    .split(",")
    .map((accountId) => accountId.trim())
    .filter(Boolean);
  const roasSummaryPrecomputePresetGroups = (
    process.env.ROAS_SUMMARY_PRECOMPUTE_PRESET_GROUPS
      ?? "yesterday|today|last_3d,last_7d,last_30d"
  )
    .split("|")
    .map((presets) => presets.trim())
    .filter(Boolean);
  if (
    roasSummaryPrecomputeEnabled &&
    Number.isFinite(roasSummaryPrecomputeIntervalMs) &&
    roasSummaryPrecomputeIntervalMs >= 60000 &&
    roasSummaryPrecomputeTargets.length > 0 &&
    roasSummaryPrecomputePresetGroups.length > 0
  ) {
    let roasSummaryRunning = false;
    const runRoasSummaryPrecompute = async () => {
      if (roasSummaryRunning) {
        // eslint-disable-next-line no-console
        console.log("[ROAS summary precompute] skip — previous tick still running");
        return;
      }
      roasSummaryRunning = true;
      let ok = 0;
      let failed = 0;
      try {
        for (const accountId of roasSummaryPrecomputeTargets) {
          for (const presets of roasSummaryPrecomputePresetGroups) {
            try {
              const controller = new AbortController();
              const timer = setTimeout(() => controller.abort(), roasSummaryPrecomputeTimeoutMs);
              const url = new URL(`${selfBaseUrl}/api/ads/roas-summary`);
              url.searchParams.set("account_id", accountId);
              url.searchParams.set("presets", presets);
              url.searchParams.set("force", "true");
              url.searchParams.set("cache_write", "1");
              url.searchParams.set("precompute", "1");
              const response = await fetch(url.toString(), {
                method: "GET",
                signal: controller.signal,
                cache: "no-store",
              });
              clearTimeout(timer);
              const body = (await response.json().catch(() => null)) as
                | { ok?: boolean; cache?: { source?: string; generation_ms?: number | null } }
                | null;
              if (response.ok && body?.ok) {
                ok += 1;
                // eslint-disable-next-line no-console
                console.log(
                  `[ROAS summary precompute] ok account=*${accountId.slice(-4)} presets=${presets} source=${body.cache?.source ?? "?"} generationMs=${body.cache?.generation_ms ?? "?"}`,
                );
              } else {
                failed += 1;
                // eslint-disable-next-line no-console
                console.error(`[ROAS summary precompute] fail account=*${accountId.slice(-4)} presets=${presets} HTTP ${response.status}`);
              }
            } catch (error) {
              failed += 1;
              // eslint-disable-next-line no-console
              console.error(
                `[ROAS summary precompute] error account=*${accountId.slice(-4)} presets=${presets}`,
                error instanceof Error ? error.message : error,
              );
            }
          }
        }
      } finally {
        roasSummaryRunning = false;
        // eslint-disable-next-line no-console
        console.log(
          `[ROAS summary precompute] tick — ok=${ok} failed=${failed} next=${Math.round(roasSummaryPrecomputeIntervalMs / 1000)}s`,
        );
      }
    };
    setTimeout(() => {
      void runRoasSummaryPrecompute();
      setInterval(() => { void runRoasSummaryPrecompute(); }, roasSummaryPrecomputeIntervalMs);
    }, Number.isFinite(roasSummaryPrecomputeStartDelayMs) ? roasSummaryPrecomputeStartDelayMs : 90_000);
    // eslint-disable-next-line no-console
    console.log(
      `[ROAS summary precompute] 활성화 — ${Math.round(roasSummaryPrecomputeIntervalMs / 60000)}분 주기 (${roasSummaryPrecomputeTargets.length} accounts × ${roasSummaryPrecomputePresetGroups.join("/")})`,
    );
  } else {
    // eslint-disable-next-line no-console
    console.log("[ROAS summary precompute] disabled by ROAS_SUMMARY_PRECOMPUTE_ENABLED=0 또는 interval<60s 또는 targets/presetGroups empty");
  }

  // Meta UTM diagnostics precompute:
  // /ads/meta-utm 기본 화면은 Meta campaigns/adsets/ads + 3개 insights call 을 동시에 읽어 첫 miss 가 길다.
  // 가장 많이 보는 biocom last_7d 조합을 먼저 warm 해 두고, 사용자는 lazy cache hit 를 받게 한다.
  const metaUtmPrecomputeEnabled = process.env.META_UTM_DIAGNOSTICS_PRECOMPUTE_ENABLED !== "0";
  const metaUtmPrecomputeIntervalMs = Number(
    process.env.META_UTM_DIAGNOSTICS_PRECOMPUTE_INTERVAL_MS ?? "720000",
  );
  const metaUtmPrecomputeStartDelayMs = Number(
    process.env.META_UTM_DIAGNOSTICS_PRECOMPUTE_START_DELAY_MS ?? "30000",
  );
  const metaUtmPrecomputeTimeoutMs = Number(
    process.env.META_UTM_DIAGNOSTICS_PRECOMPUTE_TIMEOUT_MS ?? "120000",
  );
  const metaUtmPrecomputeTargets = (
    process.env.META_UTM_DIAGNOSTICS_PRECOMPUTE_TARGETS
      ?? "act_3138805896402376"
  )
    .split(",")
    .map((accountId) => accountId.trim())
    .filter(Boolean);
  const metaUtmPrecomputePresets = (
    process.env.META_UTM_DIAGNOSTICS_PRECOMPUTE_PRESETS
      ?? "last_7d"
  )
    .split(",")
    .map((preset) => preset.trim())
    .filter(Boolean);
  if (
    metaUtmPrecomputeEnabled
    && Number.isFinite(metaUtmPrecomputeIntervalMs)
    && metaUtmPrecomputeIntervalMs >= 300000
    && metaUtmPrecomputeTargets.length > 0
    && metaUtmPrecomputePresets.length > 0
  ) {
    let metaUtmRunning = false;
    const runMetaUtmPrecompute = async () => {
      if (metaUtmRunning) {
        // eslint-disable-next-line no-console
        console.log("[Meta UTM precompute] skip - previous tick still running");
        return;
      }
      metaUtmRunning = true;
      let ok = 0;
      let failed = 0;
      try {
        for (const accountId of metaUtmPrecomputeTargets) {
          for (const preset of metaUtmPrecomputePresets) {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), metaUtmPrecomputeTimeoutMs);
            try {
              const url = new URL(`${selfBaseUrl}/api/ads/meta-utm-diagnostics`);
              url.searchParams.set("account_id", accountId);
              url.searchParams.set("date_preset", preset);
              url.searchParams.set("force", "1");
              url.searchParams.set("precompute", "1");
              const startedAt = Date.now();
              const response = await fetch(url.toString(), {
                method: "GET",
                signal: controller.signal,
                cache: "no-store",
              });
              const body = (await response.json().catch(() => null)) as
                | { ok?: boolean; rows?: unknown[]; cache?: { source?: string; cached_at_kst?: string | null } }
                | null;
              if (response.ok && body?.ok) {
                ok += 1;
                // eslint-disable-next-line no-console
                console.log(
                  `[Meta UTM precompute] ok account=*${accountId.slice(-4)} preset=${preset} rows=${body.rows?.length ?? "?"} source=${body.cache?.source ?? "?"} ${Date.now() - startedAt}ms`,
                );
              } else {
                failed += 1;
                // eslint-disable-next-line no-console
                console.error(`[Meta UTM precompute] fail account=*${accountId.slice(-4)} preset=${preset} HTTP ${response.status}`);
              }
            } catch (error) {
              failed += 1;
              // eslint-disable-next-line no-console
              console.error(
                `[Meta UTM precompute] error account=*${accountId.slice(-4)} preset=${preset}`,
                error instanceof Error ? error.message : error,
              );
            } finally {
              clearTimeout(timer);
            }
          }
        }
      } finally {
        metaUtmRunning = false;
        // eslint-disable-next-line no-console
        console.log(
          `[Meta UTM precompute] tick - ok=${ok} failed=${failed} next=${Math.round(metaUtmPrecomputeIntervalMs / 1000)}s`,
        );
      }
    };
    setTimeout(() => {
      void runMetaUtmPrecompute();
      setInterval(() => { void runMetaUtmPrecompute(); }, metaUtmPrecomputeIntervalMs);
    }, Number.isFinite(metaUtmPrecomputeStartDelayMs) ? metaUtmPrecomputeStartDelayMs : 30_000);
    // eslint-disable-next-line no-console
    console.log(
      `[Meta UTM precompute] 활성화 - ${Math.round(metaUtmPrecomputeIntervalMs / 60000)}분 주기 (${metaUtmPrecomputeTargets.length} accounts x ${metaUtmPrecomputePresets.join("/")})`,
    );
  } else {
    // eslint-disable-next-line no-console
    console.log("[Meta UTM precompute] disabled by META_UTM_DIAGNOSTICS_PRECOMPUTE_ENABLED=0 또는 interval<300s 또는 targets/presets empty");
  }
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function recoverStuckScheduledSends() {
  try {
    const result = getCrmDb().prepare(`
      UPDATE crm_scheduled_send
      SET status = 'pending', started_at = NULL
      WHERE status = 'running' AND started_at < datetime('now','-10 minutes')
    `).run();
    if (result.changes > 0) {
      // eslint-disable-next-line no-console
      console.warn(`[Scheduled send] running 상태 복구: ${result.changes}건 pending 전환`);
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[Scheduled send] recovery error:", error instanceof Error ? error.message : error);
  }
}

async function processScheduledSend(row: ScheduledSendRow) {
  let successCount = 0;
  let failCount = 0;
  let errorMessage: string | null = null;

  try {
    if (row.channel === "alimtalk" && (!row.template_code || !row.subject)) {
      throw new Error("알림톡 예약에는 template_code와 subject가 필요하다.");
    }

    const { members } = listGroupMembers(row.group_id, 10000, 0);
    for (const member of members) {
      if (!member.phone) {
        failCount++;
        continue;
      }

      const result = await sendScheduledMessage(row, member, members.length);
      const providerStatus = result.ok ? "success" : "fail";
      if (result.ok) {
        successCount++;
      } else {
        failCount++;
      }

      try {
        const responsePayload = result.ok
          ? result.body
          : result.body ?? { message: result.message };
        recordMessage({
          experiment_key: row.experiment_key ?? undefined,
          customer_key: member.phone,
          channel: row.channel,
          provider_status: providerStatus,
          template_code: row.template_code ?? undefined,
          response_payload: JSON.stringify(responsePayload),
        });
      } catch {
        // 발송 자체가 우선이며 로그 실패는 스케줄러를 멈추지 않는다.
      }

      await sleep(300);
    }
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "scheduled send failed";
    failCount = Math.max(failCount, 1);
  }

  const status = resolveScheduledSendStatus(successCount, failCount);
  finishScheduledSend(row.id, {
    status,
    successCount,
    failCount,
    errorMessage,
  });
}

async function sendScheduledMessage(row: ScheduledSendRow, member: CustomerGroupMember, batchSize: number) {
  const policy = evaluateForEnforcement({
    channel: row.channel,
    receiver: member.phone,
    memberCode: member.member_code,
    templateCode: row.template_code,
    templateType: row.template_type,
    body: row.message,
    source: "scheduled_send",
    groupId: row.group_id,
    batchSize,
    adminOverride: Number(row.admin_override) === 1,
  });
  const policyBlock = getPolicyBlock(policy);
  if (policyBlock) {
    log.warn({
      event: obsEvents.contactPolicyDecision,
      decision: "blocked",
      severity: policyBlock.severity,
      reasons: policyBlock.reasons,
      scheduledSendId: row.id,
      channel: row.channel,
      receiver: member.phone,
      templateCode: row.template_code,
      groupId: row.group_id,
    });
    return {
      ok: false,
      status: policyBlock.severity === "hard_legal" ? 451 : 403,
      reason: "contact_policy_blocked",
      message: policyBlock.reasons[0]?.message ?? "contact policy blocked",
      body: {
        ok: false,
        blocked_by_policy: true,
        severity: policyBlock.severity,
        reasons: policyBlock.reasons,
      },
    };
  }

  if (policy.adminOverride && policy.blockedReasons.length > 0) {
    log.warn({
      event: obsEvents.contactPolicyDecision,
      decision: "admin_override_allowed",
      severity: highestPolicySeverity(policy),
      reasons: policy.blockedReasons,
      scheduledSendId: row.id,
      channel: row.channel,
      receiver: member.phone,
      templateCode: row.template_code,
      groupId: row.group_id,
    });
  }

  if (row.channel === "alimtalk") {
    return sendAligo({
      tplCode: row.template_code ?? "",
      receiver: member.phone,
      recvname: member.name ?? undefined,
      subject: row.subject ?? "",
      message: row.message,
      testMode: row.test_mode ? "Y" : "N",
    });
  }

  return sendAligoSms({
    receiver: member.phone,
    message: row.message,
    testMode: row.test_mode ? "Y" : "N",
  });
}

function getPolicyBlock(policy: ContactPolicyEnforcementResult): {
  severity: Exclude<EnforcementSeverity, "soft">;
  reasons: ContactPolicyEnforcementResult["blockedReasons"];
} | null {
  const hardLegalReasons = policy.blockedReasons.filter((reason) => reason.severity === "hard_legal");
  if (hardLegalReasons.length > 0) return { severity: "hard_legal", reasons: hardLegalReasons };

  const hardPolicyReasons = policy.blockedReasons.filter((reason) => reason.severity === "hard_policy");
  if (hardPolicyReasons.length > 0 && !policy.adminOverride) {
    return { severity: "hard_policy", reasons: hardPolicyReasons };
  }

  return null;
}

function highestPolicySeverity(policy: ContactPolicyEnforcementResult): EnforcementSeverity {
  if (policy.blockedReasons.some((reason) => reason.severity === "hard_legal")) return "hard_legal";
  if (policy.blockedReasons.some((reason) => reason.severity === "hard_policy")) return "hard_policy";
  return "soft";
}

function scheduleTempGroupCleanup() {
  const delayMs = msUntilNextKstHour(3);
  setTimeout(() => {
    runTempGroupCleanup();
    setInterval(runTempGroupCleanup, 24 * 60 * 60 * 1000);
  }, delayMs);
  // eslint-disable-next-line no-console
  console.log(`[Temp group cleanup] 활성화 — 다음 실행까지 ${Math.round(delayMs / 60000)}분`);
}

function msUntilNextKstHour(hour: number): number {
  const now = Date.now();
  const kstNow = new Date(now + 9 * 60 * 60 * 1000);
  const nextTodayUtcMs = Date.UTC(
    kstNow.getUTCFullYear(),
    kstNow.getUTCMonth(),
    kstNow.getUTCDate(),
    hour,
    0,
    0,
    0,
  ) - 9 * 60 * 60 * 1000;
  const nextRun = nextTodayUtcMs > now ? nextTodayUtcMs : nextTodayUtcMs + 24 * 60 * 60 * 1000;
  return Math.max(1000, nextRun - now);
}

function runTempGroupCleanup() {
  const candidates = listArchivedCustomerGroupsForCleanup();
  let deleted = 0;
  let skipped = 0;

  for (const group of candidates) {
    const archiveCheck = canArchiveGroup(group.group_id);
    if (!archiveCheck.canArchive) {
      skipped++;
      continue;
    }
    deleteCustomerGroup(group.group_id);
    deleted++;
  }

  log.info({
    event: "temp_group_cleanup",
    scanned: candidates.length,
    deleted,
    skipped,
  });
}

function resolveScheduledSendStatus(successCount: number, failCount: number) {
  if (successCount > 0 && failCount === 0) return "success";
  if (successCount === 0) return "fail";
  return "partial";
}
