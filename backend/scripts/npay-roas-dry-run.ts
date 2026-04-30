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
  format: "json" | "markdown";
};

const parseArgs = (argv: string[]): CliOptions => {
  const options: CliOptions = { format: "markdown" };

  for (const arg of argv) {
    if (arg.startsWith("--start=")) options.start = arg.slice("--start=".length);
    if (arg.startsWith("--end=")) options.end = arg.slice("--end=".length);
    if (arg.startsWith("--output=")) options.output = arg.slice("--output=".length);
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
