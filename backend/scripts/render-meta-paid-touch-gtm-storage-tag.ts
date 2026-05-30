import { renderMetaPaidTouchGtmStorageTag } from "../src/metaPaidTouchGtmSnippet";

type CliOptions = {
  storageKey?: string;
  legacyLastTouchKey?: string;
  debugQueryKey?: string;
  ttlDays?: number;
};

const printHelp = () => {
  console.error(`Usage:
npx tsx scripts/render-meta-paid-touch-gtm-storage-tag.ts \\
  [--storage-key biocom_paid_touch_before_checkout_v1] \\
  [--legacy-last-touch-key _p1s1a_last_touch] \\
  [--debug-query-key __seo_paid_touch_debug] \\
  [--ttl-days 7]`);
};

const parseArgs = (argv: string[]): CliOptions => {
  const options: CliOptions = {};

  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    const next = argv[i + 1];

    if (current === "--storage-key" && next) {
      options.storageKey = next;
      i += 1;
      continue;
    }

    if (current === "--legacy-last-touch-key" && next) {
      options.legacyLastTouchKey = next;
      i += 1;
      continue;
    }

    if (current === "--debug-query-key" && next) {
      options.debugQueryKey = next;
      i += 1;
      continue;
    }

    if (current === "--ttl-days" && next) {
      const parsed = Number(next);
      options.ttlDays = Number.isFinite(parsed) ? parsed : undefined;
      i += 1;
      continue;
    }

    if (current === "--help") {
      printHelp();
      process.exit(0);
    }
  }

  return options;
};

const options = parseArgs(process.argv.slice(2));

process.stdout.write(`${renderMetaPaidTouchGtmStorageTag(options)}\n`);
