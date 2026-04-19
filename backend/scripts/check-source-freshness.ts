import {
  collectSourceFreshness,
  getDefaultSourceFreshnessOptions,
  printSourceFreshnessMarkdown,
} from "../src/sourceFreshness";

type CliOptions = {
  json: boolean;
  crmDbPath: string;
  warnHours: number;
  staleHours: number;
};

const parseArgs = (): CliOptions => {
  const argValue = (name: string) => {
    const prefix = `--${name}=`;
    return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
  };

  const numberArg = (name: string, fallback: number) => {
    const raw = argValue(name);
    if (!raw) return fallback;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error(`Invalid --${name}: ${raw}`);
    }
    return parsed;
  };

  const defaults = getDefaultSourceFreshnessOptions();

  return {
    json: process.argv.includes("--json"),
    crmDbPath: argValue("crmDbPath") || defaults.crmDbPath,
    warnHours: numberArg("warnHours", defaults.warnHours),
    staleHours: numberArg("staleHours", defaults.staleHours),
  };
};

const main = async () => {
  const options = parseArgs();
  const payload = await collectSourceFreshness(options);

  if (options.json) {
    console.log(JSON.stringify({ ...payload, options: { json: true, ...payload.options } }, null, 2));
  } else {
    printSourceFreshnessMarkdown(payload);
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
