#!/usr/bin/env tsx
import { writeFileSync } from "node:fs";

import {
  buildNpayRoasDryRunReport,
  renderNpayRoasDryRunMarkdown,
} from "../src/npayRoasDryRun";

type CliOptions = {
  start?: string;
  end?: string;
  output?: string;
  ga4PresentOrderNumbers: string[];
  ga4AbsentOrderNumbers: string[];
  testOrderNumbers: string[];
  orderNumbers: string[];
  format: "json" | "markdown";
};

const parseList = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const parseArgs = (argv: string[]): CliOptions => {
  const options: CliOptions = {
    format: "markdown",
    ga4PresentOrderNumbers: [],
    ga4AbsentOrderNumbers: [],
    testOrderNumbers: [],
    orderNumbers: [],
  };

  for (const arg of argv) {
    if (arg.startsWith("--start=")) options.start = arg.slice("--start=".length);
    if (arg.startsWith("--end=")) options.end = arg.slice("--end=".length);
    if (arg.startsWith("--output=")) options.output = arg.slice("--output=".length);
    if (arg.startsWith("--ga4-present=")) {
      options.ga4PresentOrderNumbers.push(...parseList(arg.slice("--ga4-present=".length)));
    }
    if (arg.startsWith("--ga4-absent=")) {
      options.ga4AbsentOrderNumbers.push(...parseList(arg.slice("--ga4-absent=".length)));
    }
    if (arg.startsWith("--test-order=")) {
      options.testOrderNumbers.push(...parseList(arg.slice("--test-order=".length)));
    }
    if (arg.startsWith("--test-orders=")) {
      options.testOrderNumbers.push(...parseList(arg.slice("--test-orders=".length)));
    }
    if (arg.startsWith("--order-number=")) {
      options.orderNumbers.push(...parseList(arg.slice("--order-number=".length)));
    }
    if (arg.startsWith("--order-numbers=")) {
      options.orderNumbers.push(...parseList(arg.slice("--order-numbers=".length)));
    }
    if (arg.startsWith("--format=")) {
      const format = arg.slice("--format=".length);
      if (format !== "json" && format !== "markdown") {
        throw new Error("--format must be json or markdown");
      }
      options.format = format;
    }
  }

  return options;
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  const report = await buildNpayRoasDryRunReport({
    start: options.start,
    end: options.end,
    ga4PresentOrderNumbers: options.ga4PresentOrderNumbers,
    ga4AbsentOrderNumbers: options.ga4AbsentOrderNumbers,
    testOrderNumbers: options.testOrderNumbers,
    orderNumbers: options.orderNumbers,
  });
  const output =
    options.format === "json"
      ? `${JSON.stringify(report, null, 2)}\n`
      : `${renderNpayRoasDryRunMarkdown(report)}\n`;

  if (options.output) {
    writeFileSync(options.output, output, "utf8");
    return;
  }

  process.stdout.write(output);
};

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`npay-roas-dry-run failed: ${message}`);
  process.exitCode = 1;
});
