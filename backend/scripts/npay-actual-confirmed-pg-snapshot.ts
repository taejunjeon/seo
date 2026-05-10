#!/usr/bin/env tsx
/**
 * NPay actual confirmed snapshot generator (운영 PG read-only).
 *
 * 목적:
 *   ConfirmedPurchasePrep `npay_actual_count` 누락을 고치기 위한 보조 입력 source 생성.
 *   운영 PG `tb_iamweb_users` NAVERPAY_ORDER + PAYMENT_COMPLETE 분포를 read-only로 가져와
 *   `data/npay-actual-confirmed-pg-snapshot-<window>d-<date>.json` 으로 저장한다.
 *
 * 사용:
 *   npm run agent -- npay-actual-confirmed-pg-snapshot --window-days 30 --output data/...
 *   또는 직접: npx tsx scripts/npay-actual-confirmed-pg-snapshot.ts --window-days 30
 *
 * 금지:
 *   - 운영DB write
 *   - raw email/phone/order 저장 또는 logging
 *   - send_candidate/actual_send_candidate/upload_candidate true
 */

import fs from "node:fs";
import path from "node:path";

import {
  estimateInternalRoasLift,
  fetchNpayActualConfirmedSnapshot,
  NPAY_ACTUAL_CONFIRMED_DEFAULT_WINDOW_DAYS,
} from "../src/npayActualConfirmedPgReader";

type CliOptions = {
  windowDays: number;
  output: string;
  baselineConfirmedOrders: number;
  baselineConfirmedRevenueKrw: number;
  baselinePlatformCostKrw: number;
};

const argValue = (key: string): string | undefined => {
  const idx = process.argv.indexOf(`--${key}`);
  if (idx < 0) return undefined;
  return process.argv[idx + 1];
};

const argInt = (key: string, defaultValue: number): number => {
  const value = argValue(key);
  if (!value) return defaultValue;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : defaultValue;
};

const argFloat = (key: string, defaultValue: number): number => {
  const value = argValue(key);
  if (!value) return defaultValue;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
};

const parseOptions = (): CliOptions => {
  const windowDays = argInt("window-days", NPAY_ACTUAL_CONFIRMED_DEFAULT_WINDOW_DAYS);
  const isoDate = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const output =
    argValue("output") ??
    path.resolve(
      __dirname,
      "..",
      "..",
      "data",
      `npay-actual-confirmed-pg-snapshot-${windowDays}d-${isoDate}.json`,
    );
  return {
    windowDays,
    output,
    baselineConfirmedOrders: argInt("baseline-confirmed-orders", 25),
    baselineConfirmedRevenueKrw: argFloat("baseline-confirmed-revenue-krw", 6493020),
    baselinePlatformCostKrw: argFloat("baseline-platform-cost-krw", 23666491.84),
  };
};

const main = async () => {
  const options = parseOptions();
  const snapshot = await fetchNpayActualConfirmedSnapshot({ windowDays: options.windowDays });
  const lift = estimateInternalRoasLift(snapshot, {
    confirmedOrders: options.baselineConfirmedOrders,
    confirmedRevenueKrw: options.baselineConfirmedRevenueKrw,
    platformCostKrw: options.baselinePlatformCostKrw,
  });

  const payload = {
    ok: snapshot.ok,
    schema_version: "npay_actual_confirmed_pg_snapshot_v1",
    generated_at_kst: kstNow(),
    site: "biocom",
    purpose:
      "ConfirmedPurchasePrep `npay_actual_count` 누락을 고치는 보조 source. 운영 PG NAVERPAY_ORDER + PAYMENT_COMPLETE 분포 + 환불/취소 제외 + amount > 0 + internal ROAS lift 추정.",
    harness_preflight: {
      lane: "Green",
      read_only: true,
      no_send: true,
      no_operational_db_write: true,
      raw_pii_logged: false,
      promotion_rule_unchanged: snapshot.promotionRule,
    },
    snapshot: {
      window_days: snapshot.windowDays,
      generated_at_iso: snapshot.generatedAtIso,
      filter: snapshot.filter,
      rows: snapshot.rows,
      total_amount_krw: snapshot.totalAmountKrw,
      avg_amount_krw: snapshot.avgAmountKrw,
      median_amount_krw: snapshot.medianAmountKrw,
      p90_amount_krw: snapshot.p90AmountKrw,
      min_amount_krw: snapshot.minAmountKrw,
      max_amount_krw: snapshot.maxAmountKrw,
      warnings: snapshot.warnings,
    },
    internal_roas_lift_estimate: lift,
    forbidden_unchanged: {
      send_candidate: false,
      actual_send_candidate: false,
      upload_candidate: false,
      npay_click_to_purchase: false,
    },
    verdict: snapshot.ok && snapshot.rows > 0 ? "PASS_NPAY_ACTUAL_CONFIRMED_SNAPSHOT" : "ZERO_OR_UNCONFIGURED",
  };

  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(options.output, JSON.stringify(payload, null, 2));
  console.log(`[npay-actual-confirmed-pg-snapshot] wrote ${options.output}`);
  console.log(
    `rows=${snapshot.rows} total_krw=${snapshot.totalAmountKrw} internal_roas_before=${lift.before.internalConfirmedRoas} after=${lift.after.internalConfirmedRoas} lift=${lift.delta.roasLift}`,
  );
};

const kstNow = () => {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return `${kst.toISOString().slice(0, 19).replace("T", " ")} KST`;
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[npay-actual-confirmed-pg-snapshot] failed", error);
    process.exit(1);
  });
