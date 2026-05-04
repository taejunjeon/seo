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
  sourceLimit: number;
  windowDays: number;
  siteSource: string;
  includeOrderNos: string[];
};

const readArg = (name: string) => {
  const index = process.argv.indexOf(name);
  if (index === -1) return "";
  return process.argv[index + 1] ?? "";
};

const parseArgs = (): Args => {
  const apply = process.argv.includes("--apply");
  const json = process.argv.includes("--json");
  const rawLimit = Number(readArg("--limit") || "50");
  const rawSourceLimit = Number(readArg("--source-limit") || "10000");
  const rawWindowDays = Number(readArg("--window-days") || "7");
  const siteSource = readArg("--site-source") || "biocom_imweb";
  const includeOrderNos = readArg("--include-order-no")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const limit = Number.isFinite(rawLimit) ? Math.trunc(rawLimit) : 10000;
  const sourceLimit = Number.isFinite(rawSourceLimit) ? Math.trunc(rawSourceLimit) : 10000;
  const windowDays = Number.isFinite(rawWindowDays) ? Math.trunc(rawWindowDays) : 7;
  if (apply && (limit < 1 || limit > 50)) {
    throw new Error("--apply requires --limit between 1 and 50");
  }
  return {
    apply,
    json,
    limit: Math.max(1, Math.min(50, limit)),
    sourceLimit: Math.max(1, Math.min(10000, sourceLimit)),
    windowDays: Math.max(1, Math.min(30, windowDays)),
    siteSource,
    includeOrderNos,
  };
};

const isoDaysAgo = (days: number) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString();
};

const selectShadowRowsForWrite = <T extends {
  candidateId: string;
  eligibleForFutureSend: boolean;
  orderNo: string;
}>(
  candidates: T[],
  limit: number,
  includeOrderNos: string[],
) => {
  const selected: T[] = [];
  const seen = new Set<string>();
  const add = (candidate: T | undefined) => {
    if (!candidate || seen.has(candidate.candidateId) || selected.length >= limit) return;
    selected.push(candidate);
    seen.add(candidate.candidateId);
  };
  candidates.filter((candidate) => candidate.eligibleForFutureSend).forEach(add);
  for (const orderNo of includeOrderNos) {
    add(candidates.find((candidate) => candidate.orderNo === orderNo));
  }
  candidates.forEach(add);
  return selected;
};

const main = () => {
  const args = parseArgs();
  const result = buildTikTokEventsApiShadowCandidatesFromDb({
    site: "biocom",
    siteSource: args.siteSource,
    startAt: isoDaysAgo(args.windowDays),
    limit: args.sourceLimit,
  });
  const selectedCandidates = selectShadowRowsForWrite(
    result.candidates,
    args.limit,
    args.includeOrderNos,
  );
  const writtenRows = args.apply
    ? upsertTikTokEventsApiShadowCandidates(selectedCandidates)
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
    sourceLimit: args.sourceLimit,
    maxShadowRows: args.limit,
    includeOrderNos: args.includeOrderNos,
    selectedShadowRows: selectedCandidates.length,
    writtenRows,
    summary: result.summary,
    selectedSample: selectedCandidates.slice(0, 10).map((candidate) => ({
      orderCode: candidate.orderCode,
      orderNo: candidate.orderNo,
      eventName: candidate.eventName,
      serverEventIdCandidate: candidate.serverEventIdCandidate,
      technicalEligibleForFutureSend: candidate.technicalEligibleForFutureSend,
      businessEligibleForFutureSend: candidate.businessEligibleForFutureSend,
      eligibleForFutureSend: candidate.eligibleForFutureSend,
      dedupReady: candidate.dedupReady,
      paymentStatus: candidate.paymentStatus,
      tiktokEvidenceType: candidate.tiktokEvidenceType,
      isManualTestOrder: candidate.isManualTestOrder,
      syntheticEvidenceReason: candidate.syntheticEvidenceReason,
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
  console.log(`sourceLimit=${output.sourceLimit}`);
  console.log(`maxShadowRows=${output.maxShadowRows}`);
  console.log(`selectedShadowRows=${output.selectedShadowRows}`);
  console.log(`writtenRows=${output.writtenRows}`);
  console.log(`totalCandidates=${output.summary.totalCandidates}`);
  console.log(`eligibleForFutureSend=${output.summary.eligibleForFutureSend}`);
  console.log(`technicalEligibleForFutureSend=${output.summary.technicalEligibleForFutureSend}`);
  console.log(`businessEligibleForFutureSend=${output.summary.businessEligibleForFutureSend}`);
  console.log(`manualTestOrders=${output.summary.manualTestOrders}`);
  console.log(`syntheticEvidenceOrders=${output.summary.syntheticEvidenceOrders}`);
  console.log(`blocked=${output.summary.blocked}`);
  console.log(`dedupReady=${output.summary.dedupReady}`);
  console.log(`sendCandidateTrue=${output.summary.sendCandidateTrue}`);
  console.log(`platformSent=${output.summary.platformSent}`);
  console.log(`countsByBlockReason=${JSON.stringify(output.summary.countsByBlockReason)}`);
};

main();
