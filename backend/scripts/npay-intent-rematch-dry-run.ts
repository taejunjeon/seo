#!/usr/bin/env tsx
import { writeFileSync } from "node:fs";

import { buildNpayIntentRematchDryRunReport } from "../src/npayRoasDryRun";

type CliOptions = {
  start?: string;
  end?: string;
  site?: string;
  sqlitePath?: string;
  output?: string;
  orderNumbers: string[];
  includeOnlyPending: boolean;
  includeRawClickIds: boolean;
  limit: number;
};

const parseList = (value: string) =>
  value
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);

const parsePositiveInt = (value: string, fallback: number, max: number) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(max, parsed));
};

const parseArgs = (argv: string[]): CliOptions => {
  const options: CliOptions = {
    orderNumbers: [],
    includeOnlyPending: true,
    includeRawClickIds: true,
    limit: 100,
  };

  for (const arg of argv) {
    if (arg.startsWith("--start=")) options.start = arg.slice("--start=".length);
    if (arg.startsWith("--end=")) options.end = arg.slice("--end=".length);
    if (arg.startsWith("--site=")) options.site = arg.slice("--site=".length);
    if (arg.startsWith("--sqlite-path=")) options.sqlitePath = arg.slice("--sqlite-path=".length);
    if (arg.startsWith("--output=")) options.output = arg.slice("--output=".length);
    if (arg.startsWith("--order-number=")) {
      options.orderNumbers.push(...parseList(arg.slice("--order-number=".length)));
    }
    if (arg.startsWith("--order-numbers=")) {
      options.orderNumbers.push(...parseList(arg.slice("--order-numbers=".length)));
    }
    if (arg === "--include-non-pending") options.includeOnlyPending = false;
    if (arg === "--redact-click-ids") options.includeRawClickIds = false;
    if (arg.startsWith("--limit=")) {
      options.limit = parsePositiveInt(arg.slice("--limit=".length), 100, 500);
    }
  }

  return options;
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  const report = await buildNpayIntentRematchDryRunReport({
    start: options.start,
    end: options.end,
    site: options.site,
    sqlitePath: options.sqlitePath,
    orderNumbers: options.orderNumbers,
    includeOnlyPending: options.includeOnlyPending,
    includeRawClickIds: options.includeRawClickIds,
    limit: options.limit,
  });
  const output = `${JSON.stringify(report, null, 2)}\n`;

  if (options.output) {
    writeFileSync(options.output, output, "utf8");
    return;
  }

  process.stdout.write(output);
};

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`npay-intent-rematch-dry-run failed: ${message}`);
  process.exitCode = 1;
});
