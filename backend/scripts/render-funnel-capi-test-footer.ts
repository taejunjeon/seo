import dotenv from "dotenv";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

type CliOptions = {
  site: "biocom" | "coffee";
  input: string;
  output: string;
};

const repoRoot = path.resolve(__dirname, "../..");

dotenv.config({ path: path.join(repoRoot, "backend/.env"), quiet: true });
dotenv.config({ path: path.join(repoRoot, ".env"), override: false, quiet: true });

const defaultInputBySite: Record<CliOptions["site"], string> = {
  biocom: path.join(repoRoot, "footer/biocom_footer_0415_final3.md"),
  coffee: path.join(repoRoot, "footer/thecleancoffee_footer_0415_final3.md"),
};

const defaultOutputBySite: Record<CliOptions["site"], string> = {
  biocom: "/tmp/biocom_footer_0415_final3_stage1_test_events.md",
  coffee: "/tmp/thecleancoffee_footer_0415_final3_stage1_test_events.md",
};

const parseArgs = (argv: string[]): CliOptions => {
  const options: CliOptions = {
    site: "biocom",
    input: "",
    output: "",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    const next = argv[i + 1];

    if (current === "--site" && (next === "biocom" || next === "coffee")) {
      options.site = next;
      i += 1;
      continue;
    }

    if (current === "--input" && next) {
      options.input = path.resolve(next);
      i += 1;
      continue;
    }

    if (current === "--output" && next) {
      options.output = path.resolve(next);
      i += 1;
      continue;
    }

    if (current === "--help") {
      printHelp();
      process.exit(0);
    }
  }

  return {
    ...options,
    input: options.input || defaultInputBySite[options.site],
    output: options.output || defaultOutputBySite[options.site],
  };
};

const printHelp = () => {
  console.error(`Usage:
npx tsx scripts/render-funnel-capi-test-footer.ts --site biocom
npx tsx scripts/render-funnel-capi-test-footer.ts --site biocom --output /tmp/biocom_stage1.md`);
};

const envNameBySite: Record<CliOptions["site"], string> = {
  biocom: "META_EVENT_CODE_BIOCOM",
  coffee: "META_EVENT_CODE_COFFEE",
};

const escapeJsSingleQuoted = (value: string) =>
  value.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\r?\n/g, "");

const requireTestEventCode = (site: CliOptions["site"]) => {
  const envName = envNameBySite[site];
  const value = process.env[envName]?.trim() ?? "";
  if (!value) {
    throw new Error(`${envName} is required`);
  }
  if (!/^[A-Za-z0-9_-]{3,120}$/.test(value)) {
    throw new Error(`${envName} has unexpected characters; refusing to render`);
  }
  return { envName, value };
};

const render = (source: string, testEventCode: string) => {
  const withServerEnabled = source.replace(
    /enableServerCapi:\s*false,/,
    "enableServerCapi: true,",
  );
  if (withServerEnabled === source) {
    throw new Error("enableServerCapi=false marker not found");
  }

  const escapedCode = escapeJsSingleQuoted(testEventCode);
  const withTestCode = withServerEnabled.replace(
    /testEventCode:\s*'',/,
    `testEventCode: '${escapedCode}',`,
  );
  if (withTestCode === withServerEnabled) {
    throw new Error("empty testEventCode marker not found");
  }

  return withTestCode;
};

const options = parseArgs(process.argv.slice(2));

if (!existsSync(options.input)) {
  throw new Error(`input file not found: ${options.input}`);
}

const { envName, value: testEventCode } = requireTestEventCode(options.site);
const source = readFileSync(options.input, "utf8");
const output = render(source, testEventCode);
writeFileSync(options.output, output);

process.stdout.write(
  JSON.stringify(
    {
      ok: true,
      site: options.site,
      input: options.input,
      output: options.output,
      envName,
      testEventCodePresent: true,
      testEventCodeLength: testEventCode.length,
      enableServerCapi: true,
      noPlatformSend: true,
      note: "Rendered local stage footer only. The test code value is not printed.",
    },
    null,
    2,
  ) + "\n",
);
