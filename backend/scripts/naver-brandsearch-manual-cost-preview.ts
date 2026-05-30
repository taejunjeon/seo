/**
 * Naver brandsearch manual contract cost preview.
 *
 * Read-only by design:
 * - No SQLite write.
 * - No Naver Ads API call or state change.
 * - No conversion send/upload.
 * - No raw identifier output.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const DAY_MS = 24 * 60 * 60 * 1000;
const SCHEMA_VERSION = "naver-brandsearch-manual-cost-preview-v1-20260525";
const DEFAULT_INPUT = "../data/project/naver-brandsearch-manual-contracts-20260525.json";

type CliOptions = {
  input: string;
  since: string;
  until: string;
  output: string;
  json: boolean;
  expandRenewals: boolean;
  maxRenewalCycles: number;
};

type ManualContractsFile = {
  schema_version: string;
  source: string;
  source_note?: string;
  api_status?: string;
  renewal_assumption?: string;
  currency: "KRW";
  contracts: ManualContract[];
};

type ManualContract = {
  site: string;
  brand: string;
  channel: "naver_brandsearch";
  device: "mobile" | "pc" | string;
  amount_krw: number;
  period_start: string;
  period_end: string;
  period_days: number;
  renewal_period_days: number;
  contract_possible_searches: number | null;
  confirmed_by: string;
  source_confidence: string;
};

type DailyCostRow = {
  site: string;
  date: string;
  channel: "naver_brandsearch";
  device: string;
  cost_krw: number;
  contract_amount_krw: number;
  contract_period_start: string;
  contract_period_end: string;
  contract_period_days: number;
  cycle_index: number;
  source_type: "manual_contract_confirmed" | "manual_contract_renewal_assumption";
  contract_possible_searches: number | null;
};

const usage = () => `
Usage:
  npx tsx scripts/naver-brandsearch-manual-cost-preview.ts [options]

Options:
  --input=path                    Manual contract JSON. Default: ${DEFAULT_INPUT}
  --since=YYYY-MM-DD              Inclusive KST date. Default: earliest contract start
  --until=YYYY-MM-DD              Inclusive KST date. Default: latest initial contract end
  --output=path                   Write JSON output to path
  --no-renewals                   Do not project future renewal cycles
  --max-renewal-cycles=12         Safety cap for projected cycles
  --json                          Print JSON only
  --help                          Show help
`;

const isDateString = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value);

const parseDate = (date: string): number => Date.parse(`${date}T00:00:00.000Z`);

const formatDate = (timestamp: number): string => new Date(timestamp).toISOString().slice(0, 10);

const addDays = (date: string, days: number): string => formatDate(parseDate(date) + days * DAY_MS);

const inclusiveDayCount = (start: string, end: string): number => {
  return Math.floor((parseDate(end) - parseDate(start)) / DAY_MS) + 1;
};

const minDate = (dates: string[]): string => dates.reduce((min, date) => date < min ? date : min, dates[0] ?? "");

const maxDate = (dates: string[]): string => dates.reduce((max, date) => date > max ? date : max, dates[0] ?? "");

const parseArgs = (argv: string[]): CliOptions => {
  const options: CliOptions = {
    input: DEFAULT_INPUT,
    since: "",
    until: "",
    output: "",
    json: false,
    expandRenewals: true,
    maxRenewalCycles: 12,
  };

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      console.log(usage().trim());
      process.exit(0);
    }
    if (arg === "--json") {
      options.json = true;
      continue;
    }
    if (arg === "--no-renewals") {
      options.expandRenewals = false;
      continue;
    }
    if (arg.startsWith("--input=")) {
      options.input = arg.slice("--input=".length).trim() || options.input;
      continue;
    }
    if (arg.startsWith("--since=")) {
      options.since = arg.slice("--since=".length).trim();
      continue;
    }
    if (arg.startsWith("--until=")) {
      options.until = arg.slice("--until=".length).trim();
      continue;
    }
    if (arg.startsWith("--output=")) {
      options.output = arg.slice("--output=".length).trim();
      continue;
    }
    if (arg.startsWith("--max-renewal-cycles=")) {
      options.maxRenewalCycles = Number(arg.slice("--max-renewal-cycles=".length).trim());
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (options.since && !isDateString(options.since)) {
    throw new Error("since must be YYYY-MM-DD");
  }
  if (options.until && !isDateString(options.until)) {
    throw new Error("until must be YYYY-MM-DD");
  }
  if (!Number.isInteger(options.maxRenewalCycles) || options.maxRenewalCycles < 1 || options.maxRenewalCycles > 36) {
    throw new Error("max-renewal-cycles must be an integer between 1 and 36");
  }

  return options;
};

const assertManualContractsFile = (value: unknown): ManualContractsFile => {
  if (!value || typeof value !== "object") {
    throw new Error("Manual contract file must be an object");
  }
  const file = value as ManualContractsFile;
  if (!Array.isArray(file.contracts) || file.contracts.length === 0) {
    throw new Error("Manual contract file must include contracts[]");
  }
  for (const contract of file.contracts) {
    if (!contract.site || !contract.device || contract.channel !== "naver_brandsearch") {
      throw new Error("Each contract must include site/device/channel=naver_brandsearch");
    }
    if (!isDateString(contract.period_start) || !isDateString(contract.period_end)) {
      throw new Error("Each contract must include YYYY-MM-DD period_start/period_end");
    }
    if (contract.period_start > contract.period_end) {
      throw new Error(`Invalid period for ${contract.site}/${contract.device}`);
    }
    const periodDays = inclusiveDayCount(contract.period_start, contract.period_end);
    if (periodDays !== contract.period_days) {
      throw new Error(`${contract.site}/${contract.device} period_days mismatch: expected ${periodDays}, got ${contract.period_days}`);
    }
    if (!Number.isInteger(contract.amount_krw) || contract.amount_krw <= 0) {
      throw new Error(`${contract.site}/${contract.device} amount_krw must be positive integer`);
    }
  }
  return file;
};

const readInput = (input: string): ManualContractsFile => {
  const path = resolve(process.cwd(), input);
  return assertManualContractsFile(JSON.parse(readFileSync(path, "utf8")) as unknown);
};

const allocateDailyCosts = (
  contract: ManualContract,
  cycleStart: string,
  cycleIndex: number,
): DailyCostRow[] => {
  const days = contract.renewal_period_days;
  const cycleEnd = addDays(cycleStart, days - 1);
  const base = Math.floor(contract.amount_krw / days);
  const remainder = contract.amount_krw - base * days;
  const rows: DailyCostRow[] = [];

  for (let index = 0; index < days; index += 1) {
    rows.push({
      site: contract.site,
      date: addDays(cycleStart, index),
      channel: contract.channel,
      device: contract.device,
      cost_krw: base + (index < remainder ? 1 : 0),
      contract_amount_krw: contract.amount_krw,
      contract_period_start: cycleStart,
      contract_period_end: cycleEnd,
      contract_period_days: days,
      cycle_index: cycleIndex,
      source_type: cycleIndex === 0 ? "manual_contract_confirmed" : "manual_contract_renewal_assumption",
      contract_possible_searches: contract.contract_possible_searches,
    });
  }

  return rows;
};

const expandContractRows = (
  contract: ManualContract,
  options: CliOptions,
): DailyCostRow[] => {
  const rows: DailyCostRow[] = [];
  let cycleStart = contract.period_start;
  let cycleIndex = 0;

  while (cycleStart <= options.until && cycleIndex < options.maxRenewalCycles) {
    rows.push(...allocateDailyCosts(contract, cycleStart, cycleIndex));
    if (!options.expandRenewals) break;
    cycleStart = addDays(cycleStart, contract.renewal_period_days);
    cycleIndex += 1;
  }

  return rows.filter((row) => row.date >= options.since && row.date <= options.until);
};

const sum = (rows: DailyCostRow[]): number => rows.reduce((total, row) => total + row.cost_krw, 0);

const groupBy = <T>(rows: T[], keyFn: (row: T) => string): Map<string, T[]> => {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const key = keyFn(row);
    const current = grouped.get(key) ?? [];
    current.push(row);
    grouped.set(key, current);
  }
  return grouped;
};

const main = () => {
  const options = parseArgs(process.argv.slice(2));
  const input = readInput(options.input);
  const since = options.since || minDate(input.contracts.map((contract) => contract.period_start));
  const until = options.until || maxDate(input.contracts.map((contract) => contract.period_end));

  if (!since || !until || since > until) {
    throw new Error("Invalid preview window");
  }
  options.since = since;
  options.until = until;

  const dailyRows = input.contracts
    .flatMap((contract) => expandContractRows(contract, options))
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      if (a.site !== b.site) return a.site.localeCompare(b.site);
      return a.device.localeCompare(b.device);
    });

  const bySite = [...groupBy(dailyRows, (row) => row.site)].map(([site, rows]) => ({
    site,
    cost_krw: sum(rows),
    row_count: rows.length,
  })).sort((a, b) => a.site.localeCompare(b.site));

  const bySiteDevice = [...groupBy(dailyRows, (row) => `${row.site}|${row.device}`)].map(([key, rows]) => {
    const [site, device] = key.split("|");
    return {
      site,
      device,
      cost_krw: sum(rows),
      row_count: rows.length,
    };
  }).sort((a, b) => {
    if (a.site !== b.site) return a.site.localeCompare(b.site);
    return a.device.localeCompare(b.device);
  });

  const initialContractTotals = input.contracts.map((contract) => ({
    site: contract.site,
    device: contract.device,
    period_start: contract.period_start,
    period_end: contract.period_end,
    period_days: contract.period_days,
    amount_krw: contract.amount_krw,
    contract_possible_searches: contract.contract_possible_searches,
  }));

  const output = {
    ok: true,
    schema_version: SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    input_schema_version: input.schema_version,
    source: input.source,
    source_note: input.source_note ?? "",
    api_status: input.api_status ?? "",
    renewal_assumption: input.renewal_assumption ?? "",
    window: {
      since: options.since,
      until: options.until,
      timezone: "KST",
      renewal_projection_enabled: options.expandRenewals,
      max_renewal_cycles: options.maxRenewalCycles,
    },
    confidence: "manual_confirmed_for_first_contract_period_medium_for_projected_renewals",
    totals: {
      total_cost_krw: sum(dailyRows),
      confirmed_initial_contract_cost_krw: initialContractTotals.reduce((total, row) => total + row.amount_krw, 0),
      projected_or_partial_cost_krw: sum(dailyRows.filter((row) => row.cycle_index > 0)),
      daily_rows: dailyRows.length,
    },
    initial_contract_totals: initialContractTotals,
    by_site: bySite,
    by_site_device: bySiteDevice,
    daily_rows: dailyRows,
    invariants_held: {
      api_call: 0,
      sqlite_write: 0,
      naver_ads_state_change: 0,
      platform_send: 0,
      raw_identifier_output: 0,
    },
    notes: [
      "Daily cost allocation preserves each contract total by distributing integer KRW across inclusive period days.",
      "Cycle 0 rows are confirmed manual contracts. Later cycles are renewal assumptions until TJ updates the source.",
      "This preview is a reporting cost source only. It does not change Naver Ads, orders, conversions, or VM Cloud data.",
    ],
  };

  if (options.output) {
    mkdirSync(dirname(options.output), { recursive: true });
    writeFileSync(options.output, `${JSON.stringify(output, null, 2)}\n`);
  }

  if (options.json) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  console.log("Naver brandsearch manual cost preview");
  console.log(`source: ${output.source}`);
  console.log(`window: ${options.since}..${options.until} KST`);
  console.log(`total_cost_krw: ${output.totals.total_cost_krw.toLocaleString("ko-KR")}`);
  for (const row of bySiteDevice) {
    console.log(`${row.site}/${row.device}: ${row.cost_krw.toLocaleString("ko-KR")} KRW (${row.row_count} daily rows)`);
  }
  if (options.output) console.log(`output: ${options.output}`);
};

main();
