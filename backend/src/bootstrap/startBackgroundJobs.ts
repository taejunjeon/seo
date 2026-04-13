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
import { log, obsEvents } from "../obs";
import {
  getCachedResult,
  runPageSpeedTest,
  setCachedResult,
  type PageSpeedStrategy,
} from "../pagespeed";
import { syncAttributionPaymentStatusesFromToss } from "../routes/attribution";
import { persistPageSpeedResult } from "../routes/pagespeed";

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
  const scheduledSendPollMs = env.SCHEDULED_SEND_POLL_MS;

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
