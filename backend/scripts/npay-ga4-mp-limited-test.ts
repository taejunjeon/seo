#!/usr/bin/env tsx
import { readFileSync, writeFileSync } from "node:fs";

import { env } from "../src/env";
import {
  buildNpayRoasDryRunReport,
  type NpayRoasDryRunCandidate,
  type NpayRoasDryRunOrderResult,
} from "../src/npayRoasDryRun";

type Mode = "dry-run" | "validate" | "send";

type CliOptions = {
  mode: Mode;
  orderNumber: string;
  confirmOrder?: string;
  start?: string;
  end?: string;
  output?: string;
  ga4RobustAbsentOrderNumbers: string[];
};

type Ga4ValidationMessage = {
  fieldPath?: string;
  description?: string;
  validationCode?: string;
};

type Ga4DebugResponse = {
  validationMessages?: Ga4ValidationMessage[];
};

type Ga4PurchasePayload = {
  client_id: string;
  timestamp_micros?: number;
  non_personalized_ads: boolean;
  validation_behavior?: "ENFORCE_RECOMMENDATIONS";
  events: Array<{
    name: "purchase";
    params: {
      transaction_id: string;
      channel_order_no: string;
      event_id: string;
      value: number;
      currency: "KRW";
      session_id: number;
      engagement_time_msec: number;
      npay_recovery_source: "server_mp_limited_test";
      recovery_reason: "npay_return_missing";
      dispatch_dedupe_key: string;
      payment_method: "NAVERPAY_ORDER";
      matched_intent_id: string;
      items: Array<{
        item_id: string;
        item_name: string;
        price: number;
        quantity: number;
      }>;
    };
  }>;
};

type ScriptOutput = {
  ok: boolean;
  mode: Mode;
  generatedAt: string;
  targetOrderNumber: string;
  guardPass: boolean;
  guardFailures: string[];
  measurementId: string;
  dryRunSummary: {
    liveIntentCount: number;
    confirmedNpayOrderCount: number;
    dispatcherDryRunCandidate: number;
    alreadyInGa4LookupRobustAbsent: number;
  };
  order: {
    orderNumber: string;
    channelOrderNo: string;
    paidAt: string;
    paidAtWithin72Hours: boolean;
    paidAtAgeHours: number | null;
    status: string;
    strongGrade: string | null;
    orderLabel: string;
    alreadyInGa4: string;
    dispatcherCandidate: boolean;
    blockReasons: string[];
  } | null;
  bestCandidate: {
    intentId: string;
    capturedAt: string;
    score: number;
    timeGapMinutes: number;
    amountMatchType: string;
    clientIdPresent: boolean;
    gaSessionIdPresent: boolean;
    adClickKeys: string[];
  } | null;
  payloadPreview: Ga4PurchasePayload | null;
  debug: {
    requested: boolean;
    httpStatus: number | null;
    validationMessages: Ga4ValidationMessage[];
    rawBody: string | null;
  };
  send: {
    requested: boolean;
    sent: boolean;
    httpStatus: number | null;
    responseBody: string | null;
  };
};

const DEFAULT_START = "2026-04-27T09:10:00.000Z";

const usage = () => `
Usage:
  npm exec tsx scripts/npay-ga4-mp-limited-test.ts -- --order-number=202604302383065 --ga4-robust-absent=<ids> [--mode=dry-run|validate|send]

Safety:
  --mode=send also requires --confirm-order=<same order number>.
`;

const parseList = (value: string) =>
  value
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);

const parseListFile = (filePath: string) => parseList(readFileSync(filePath, "utf8"));

const parseArgs = (argv: string[]): CliOptions => {
  const options: CliOptions = {
    mode: "dry-run",
    orderNumber: "",
    ga4RobustAbsentOrderNumbers: [],
  };

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      process.stdout.write(usage());
      process.exit(0);
    }
    if (arg.startsWith("--mode=")) {
      const mode = arg.slice("--mode=".length) as Mode;
      if (!["dry-run", "validate", "send"].includes(mode)) {
        throw new Error("--mode must be dry-run, validate, or send");
      }
      options.mode = mode;
    }
    if (arg.startsWith("--order-number=")) options.orderNumber = arg.slice("--order-number=".length).trim();
    if (arg.startsWith("--confirm-order=")) options.confirmOrder = arg.slice("--confirm-order=".length).trim();
    if (arg.startsWith("--start=")) options.start = arg.slice("--start=".length).trim();
    if (arg.startsWith("--end=")) options.end = arg.slice("--end=".length).trim();
    if (arg.startsWith("--output=")) options.output = arg.slice("--output=".length).trim();
    if (arg.startsWith("--ga4-robust-absent=")) {
      options.ga4RobustAbsentOrderNumbers.push(...parseList(arg.slice("--ga4-robust-absent=".length)));
    }
    if (arg.startsWith("--ga4-robust-absent-file=")) {
      options.ga4RobustAbsentOrderNumbers.push(
        ...parseListFile(arg.slice("--ga4-robust-absent-file=".length)),
      );
    }
  }

  if (!options.orderNumber) throw new Error("--order-number is required");
  if (options.ga4RobustAbsentOrderNumbers.length === 0) {
    throw new Error("--ga4-robust-absent or --ga4-robust-absent-file is required");
  }

  return options;
};

const pickGa4Credentials = () => {
  const measurementId = env.GA4_MEASUREMENT_ID_BIOCOM?.trim();
  const apiSecret = env.GA4_MP_API_SECRET_BIOCOM?.trim();
  if (!measurementId) throw new Error("GA4_MEASUREMENT_ID_BIOCOM is missing");
  if (!apiSecret) throw new Error("GA4_MP_API_SECRET_BIOCOM or GA4_PROTOCOL_API_PASS is missing");
  return { measurementId, apiSecret };
};

const toNumber = (value: string | null) => {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const collectGuardFailures = (
  result: NpayRoasDryRunOrderResult | null,
  orderNumber: string,
  confirmOrder: string | undefined,
  mode: Mode,
) => {
  const failures: string[] = [];
  if (!result) {
    return ["target_order_not_found"];
  }
  if (result.order.orderNumber !== orderNumber) failures.push("order_number_mismatch");
  if (result.status !== "strong_match") failures.push(`status_${result.status}`);
  if (result.strongGrade !== "A") failures.push("not_a_grade_strong");
  if (result.orderLabel !== "production_order") failures.push(`order_label_${result.orderLabel}`);
  if (result.dispatcherDryRun.alreadyInGa4 !== "robust_absent") {
    failures.push(`already_in_ga4_${result.dispatcherDryRun.alreadyInGa4}`);
  }
  if (!result.dispatcherDryRun.candidate) failures.push("dispatcher_candidate_false");
  if (result.dispatcherDryRun.blockReasons.length > 0) {
    failures.push(...result.dispatcherDryRun.blockReasons.map((reason) => `block_${reason}`));
  }
  if (!result.ga4PayloadPreview.clientIdPresent) failures.push("client_id_missing");
  if (!result.ga4PayloadPreview.gaSessionIdPresent) failures.push("ga_session_id_missing");
  if (!result.ga4PayloadPreview.paidAtWithin72Hours) failures.push("paid_at_not_within_72h");
  if (result.ga4PayloadPreview.value === null || result.ga4PayloadPreview.value <= 0) {
    failures.push("invalid_value");
  }
  if (!result.bestCandidate) failures.push("best_candidate_missing");
  if (mode === "send" && confirmOrder !== orderNumber) failures.push("send_confirmation_missing");
  return Array.from(new Set(failures));
};

const buildPayload = (
  result: NpayRoasDryRunOrderResult,
  bestCandidate: NpayRoasDryRunCandidate,
): Ga4PurchasePayload => {
  const preview = result.ga4PayloadPreview;
  const timestamp = toNumber(preview.timestampMicros);
  const sessionId = Number(bestCandidate.gaSessionId);
  if (!Number.isFinite(sessionId)) {
    throw new Error(`Invalid ga_session_id for session_id: ${bestCandidate.gaSessionId}`);
  }
  if (preview.value === null) throw new Error("Missing GA4 purchase value");

  const itemId = bestCandidate.productIdx || result.order.orderNumber;
  const itemName = bestCandidate.productName || result.order.productNames.join(" + ") || "NPay recovered item";
  const itemPrice = bestCandidate.intentProductPrice ?? result.order.orderItemTotal ?? preview.value;

  return {
    client_id: preview.clientId,
    ...(timestamp ? { timestamp_micros: timestamp } : {}),
    non_personalized_ads: false,
    events: [
      {
        name: "purchase",
        params: {
          transaction_id: result.order.orderNumber,
          channel_order_no: result.order.channelOrderNo,
          event_id: preview.eventId,
          value: preview.value,
          currency: "KRW",
          session_id: sessionId,
          engagement_time_msec: 1,
          npay_recovery_source: "server_mp_limited_test",
          recovery_reason: "npay_return_missing",
          dispatch_dedupe_key: preview.dispatchDedupeKey,
          payment_method: "NAVERPAY_ORDER",
          matched_intent_id: bestCandidate.intentId,
          items: [
            {
              item_id: itemId,
              item_name: itemName,
              price: itemPrice,
              quantity: 1,
            },
          ],
        },
      },
    ],
  };
};

const postGa4 = async (
  path: "debug/mp/collect" | "mp/collect",
  measurementId: string,
  apiSecret: string,
  payload: Ga4PurchasePayload,
) => {
  const url = new URL(`https://www.google-analytics.com/${path}`);
  url.searchParams.set("measurement_id", measurementId);
  url.searchParams.set("api_secret", apiSecret);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  return { status: res.status, ok: res.ok, text };
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  const { measurementId, apiSecret } = pickGa4Credentials();
  const generatedAt = new Date().toISOString();
  const report = await buildNpayRoasDryRunReport({
    start: options.start ?? DEFAULT_START,
    end: options.end,
    ga4RobustAbsentOrderNumbers: options.ga4RobustAbsentOrderNumbers,
    orderNumbers: [options.orderNumber],
  });
  const result = report.orderResults.find((item) => item.order.orderNumber === options.orderNumber) ?? null;
  const guardFailures = collectGuardFailures(result, options.orderNumber, options.confirmOrder, options.mode);
  const guardPass = guardFailures.length === 0;
  const bestCandidate = result?.bestCandidate ?? null;
  const payload = result && bestCandidate ? buildPayload(result, bestCandidate) : null;
  const output: ScriptOutput = {
    ok: false,
    mode: options.mode,
    generatedAt,
    targetOrderNumber: options.orderNumber,
    guardPass,
    guardFailures,
    measurementId,
    dryRunSummary: {
      liveIntentCount: report.summary.liveIntentCount,
      confirmedNpayOrderCount: report.summary.confirmedNpayOrderCount,
      dispatcherDryRunCandidate: report.summary.dispatcherDryRunCandidate,
      alreadyInGa4LookupRobustAbsent: report.summary.alreadyInGa4LookupRobustAbsent,
    },
    order: result
      ? {
          orderNumber: result.order.orderNumber,
          channelOrderNo: result.order.channelOrderNo,
          paidAt: result.order.paidAt,
          paidAtWithin72Hours: result.ga4PayloadPreview.paidAtWithin72Hours,
          paidAtAgeHours: result.ga4PayloadPreview.paidAtAgeHours,
          status: result.status,
          strongGrade: result.strongGrade,
          orderLabel: result.orderLabel,
          alreadyInGa4: result.dispatcherDryRun.alreadyInGa4,
          dispatcherCandidate: result.dispatcherDryRun.candidate,
          blockReasons: result.dispatcherDryRun.blockReasons,
        }
      : null,
    bestCandidate: bestCandidate
      ? {
          intentId: bestCandidate.intentId,
          capturedAt: bestCandidate.capturedAt,
          score: bestCandidate.score,
          timeGapMinutes: bestCandidate.timeGapMinutes,
          amountMatchType: bestCandidate.amountMatchType,
          clientIdPresent: bestCandidate.clientIdPresent,
          gaSessionIdPresent: bestCandidate.gaSessionIdPresent,
          adClickKeys: bestCandidate.adClickKeys,
        }
      : null,
    payloadPreview: payload,
    debug: {
      requested: options.mode === "validate" || options.mode === "send",
      httpStatus: null,
      validationMessages: [],
      rawBody: null,
    },
    send: {
      requested: options.mode === "send",
      sent: false,
      httpStatus: null,
      responseBody: null,
    },
  };

  if (!payload) {
    output.ok = false;
  } else if (options.mode === "validate" || options.mode === "send") {
    const debugPayload: Ga4PurchasePayload = {
      ...payload,
      validation_behavior: "ENFORCE_RECOMMENDATIONS",
    };
    const debugResponse = await postGa4("debug/mp/collect", measurementId, apiSecret, debugPayload);
    output.debug.httpStatus = debugResponse.status;
    output.debug.rawBody = debugResponse.text || null;
    try {
      const parsed = debugResponse.text ? (JSON.parse(debugResponse.text) as Ga4DebugResponse) : {};
      output.debug.validationMessages = parsed.validationMessages ?? [];
    } catch {
      output.debug.validationMessages = [
        {
          fieldPath: "debug_response",
          description: "Could not parse GA4 debug response body",
          validationCode: "PARSE_ERROR",
        },
      ];
    }

    if (!debugResponse.ok) guardFailures.push(`ga4_debug_http_${debugResponse.status}`);
    if (output.debug.validationMessages.length > 0) guardFailures.push("ga4_debug_validation_messages");
    output.guardFailures = Array.from(new Set(guardFailures));
    output.guardPass = output.guardFailures.length === 0;

    if (options.mode === "send" && output.guardPass) {
      const sendResponse = await postGa4("mp/collect", measurementId, apiSecret, payload);
      output.send.httpStatus = sendResponse.status;
      output.send.responseBody = sendResponse.text || null;
      output.send.sent = sendResponse.ok;
      output.ok = sendResponse.ok;
      if (!sendResponse.ok) {
        output.guardFailures.push(`ga4_collect_http_${sendResponse.status}`);
        output.guardPass = false;
      }
    } else {
      output.ok = output.guardPass;
    }
  } else {
    output.ok = guardPass;
  }

  const serialized = `${JSON.stringify(output, null, 2)}\n`;
  if (options.output) {
    writeFileSync(options.output, serialized, "utf8");
  } else {
    process.stdout.write(serialized);
  }

  if (!output.ok && options.mode === "send") {
    process.exitCode = 1;
  }
};

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`npay-ga4-mp-limited-test failed: ${message}`);
  process.exitCode = 1;
});
