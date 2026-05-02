#!/usr/bin/env tsx

import "../src/env";

import {
  buildTikTokEventsApiShadowCandidatesFromDb,
  upsertTikTokEventsApiShadowCandidates,
} from "../src/tiktokEventsApiShadowCandidates";

type Args = {
  apply: boolean;
  json: boolean;
  limit: number;
  windowDays: number;
  siteSource: string;
};

const readArg = (name: string) => {
  const index = process.argv.indexOf(name);
  if (index === -1) return "";
  return process.argv[index + 1] ?? "";
};

const parseArgs = (): Args => {
  const apply = process.argv.includes("--apply");
  const json = process.argv.includes("--json");
  const rawLimit = Number(readArg("--limit") || "10000");
  const rawWindowDays = Number(readArg("--window-days") || "7");
  const siteSource = readArg("--site-source") || "biocom_imweb";
  const limit = Number.isFinite(rawLimit) ? Math.trunc(rawLimit) : 10000;
  const windowDays = Number.isFinite(rawWindowDays) ? Math.trunc(rawWindowDays) : 7;
  if (apply && (limit < 1 || limit > 50)) {
    throw new Error("--apply requires --limit between 1 and 50");
  }
  return {
    apply,
    json,
    limit,
    windowDays: Math.max(1, Math.min(30, windowDays)),
    siteSource,
  };
};

const isoDaysAgo = (days: number) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString();
};

const main = () => {
  const args = parseArgs();
  const result = buildTikTokEventsApiShadowCandidatesFromDb({
    site: "biocom",
    siteSource: args.siteSource,
    startAt: isoDaysAgo(args.windowDays),
    limit: args.limit,
  });
  const writtenRows = args.apply
    ? upsertTikTokEventsApiShadowCandidates(result.candidates.slice(0, args.limit))
    : 0;
  const output = {
    mode: args.apply ? "apply_shadow_only" : "dry_run",
    noPlatformSend: true,
    noOperatingDbWrite: true,
    storage: args.apply
      ? "CRM_LOCAL_DB_PATH#tiktok_events_api_shadow_candidates"
      : "dry-run only, no DB write",
    windowDays: args.windowDays,
    siteSource: args.siteSource,
    writtenRows,
    summary: result.summary,
    sample: result.candidates.slice(0, 10).map((candidate) => ({
      orderCode: candidate.orderCode,
      orderNo: candidate.orderNo,
      eventName: candidate.eventName,
      serverEventIdCandidate: candidate.serverEventIdCandidate,
      eligibleForFutureSend: candidate.eligibleForFutureSend,
      dedupReady: candidate.dedupReady,
      paymentStatus: candidate.paymentStatus,
      tiktokEvidenceType: candidate.tiktokEvidenceType,
      blockReasons: candidate.blockReasons,
    })),
  };
  if (args.json) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }
  console.log("TikTok Events API Shadow Candidate Ledger");
  console.log(`mode=${output.mode}`);
  console.log(`storage=${output.storage}`);
  console.log(`windowDays=${output.windowDays}`);
  console.log(`siteSource=${output.siteSource}`);
  console.log(`writtenRows=${output.writtenRows}`);
  console.log(`totalCandidates=${output.summary.totalCandidates}`);
  console.log(`eligibleForFutureSend=${output.summary.eligibleForFutureSend}`);
  console.log(`blocked=${output.summary.blocked}`);
  console.log(`dedupReady=${output.summary.dedupReady}`);
  console.log(`sendCandidateTrue=${output.summary.sendCandidateTrue}`);
  console.log(`platformSent=${output.summary.platformSent}`);
  console.log(`countsByBlockReason=${JSON.stringify(output.summary.countsByBlockReason)}`);
};

main();
