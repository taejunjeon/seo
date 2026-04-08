import { renderImwebPaymentSuccessSnippet } from "../src/imwebAttributionSnippet";

type CliOptions = {
  endpointBase: string;
  source: string;
  measurementIds: string[];
  debugQueryKey?: string;
};

const parseArgs = (argv: string[]): CliOptions => {
  const options: CliOptions = {
    endpointBase: "",
    source: "",
    measurementIds: [],
  };

  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    const next = argv[i + 1];

    if (current === "--endpoint-base" && next) {
      options.endpointBase = next;
      i += 1;
      continue;
    }

    if (current === "--source" && next) {
      options.source = next;
      i += 1;
      continue;
    }

    if (current === "--measurement-id" && next) {
      options.measurementIds.push(next);
      i += 1;
      continue;
    }

    if (current === "--debug-query-key" && next) {
      options.debugQueryKey = next;
      i += 1;
      continue;
    }

    if (current === "--help") {
      printHelp();
      process.exit(0);
    }
  }

  if (!options.endpointBase || !options.source || options.measurementIds.length === 0) {
    printHelp();
    process.exit(1);
  }

  return options;
};

const printHelp = () => {
  console.error(`Usage:
npx tsx scripts/render-imweb-attribution-snippet.ts \\
  --endpoint-base https://att.example.com \\
  --source biocom_imweb \\
  --measurement-id G-WJFXN5E2Q1 \\
  --measurement-id G-8GZ48B1S59`);
};

const options = parseArgs(process.argv.slice(2));

process.stdout.write(
  `${renderImwebPaymentSuccessSnippet({
    endpointBase: options.endpointBase,
    source: options.source,
    measurementIds: options.measurementIds,
    debugQueryKey: options.debugQueryKey,
  })}\n`,
);
