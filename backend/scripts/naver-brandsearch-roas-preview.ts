#!/usr/bin/env tsx
/**
 * Naver brandsearch ROAS preview reader.
 *
 * Green Lane / read-only by design:
 * - VM Cloud SQLite is opened in read-only mode through SSH.
 * - No SQLite write, deploy, platform send, or conversion upload.
 * - Output is aggregate-only. Raw order/payment/click/member identifiers are never selected.
 */

import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const SCHEMA_VERSION = "naver-brandsearch-roas-preview-v1-20260525";
const DEFAULT_VM_HOST = "34.64.104.94";
const DEFAULT_VM_USER = "taejun";
const DEFAULT_VM_KEY = "~/.ssh/id_ed25519";
const DEFAULT_VM_DB = "/home/biocomkr_sns/seo/repo/backend/data/crm.sqlite3";
const DEFAULT_VM_RUN_AS = "biocomkr_sns";
const DEFAULT_SITES = ["biocom", "thecleancoffee"];
const SITE_ALIASES: Record<string, string[]> = {
  biocom: ["biocom"],
  thecleancoffee: ["thecleancoffee", "coffee"],
};

type CliOptions = {
  since: string;
  until: string;
  sites: string[];
  output: string;
  json: boolean;
  vmHost: string;
  vmUser: string;
  vmKey: string;
  vmDb: string;
  vmRunAs: string;
};

type VmPayload = {
  ok: true;
  generated_at_kst: string;
  requested_window: { since: string; until: string; timezone: "KST" };
  schema_freshness: {
    cost_table_exists: boolean;
    cost_min_date: string;
    cost_max_date: string;
    cost_rows: number;
  cost_cached_at_max: string;
  landing_max_landed_at: string;
  attribution_max_logged_at: string;
  };
  cost_by_site_device: CostDeviceRow[];
  cost_by_site_date: CostDateRow[];
  landing_by_site_date: LandingDateRow[];
  payment_by_site_date: PaymentDateRow[];
  invariants_held: Record<string, unknown>;
};

type CostDeviceRow = {
  site: string;
  device: string;
  min_date: string;
  max_date: string;
  row_count: number;
  cost_krw: number;
  confirmed_cost_krw: number;
  renewal_assumption_cost_krw: number;
};

type CostDateRow = {
  site: string;
  date: string;
  cost_krw: number;
};

type LandingDateRow = {
  site: string;
  date: string;
  landing_rows: number;
};

type PaymentDateRow = {
  site: string;
  date: string;
  payment_success_rows: number;
  payment_success_amount_krw: number;
};

type SiteSummary = {
  site: string;
  effective_window: { since: string; until: string; timezone: "KST" };
  cost: {
    total_cost_krw: number;
    confirmed_contract_cost_krw: number;
    renewal_assumption_cost_krw: number;
    devices: CostDeviceRow[];
  };
  evidence: {
    brandsearch_landing_rows: number;
    vm_confirmed_payment_success_rows: number;
    vm_confirmed_payment_success_amount_krw: number;
  };
  roas: {
    internal_vm_payment_success_roas: number | null;
    interpretation: string;
  };
  source_status: {
    cost_source: string;
    revenue_source: string;
    confidence: "high" | "medium_high" | "medium" | "low";
    warnings: string[];
  };
};

type Output = {
  ok: true;
  schema_version: string;
  generated_at: string;
  mode: "read_only_no_send";
  requested_window: { since: string; until: string; timezone: "KST" };
  source: {
    cost_primary: string;
    revenue_preview: string;
    landing_evidence: string;
    caveats: string[];
  };
  freshness: VmPayload["schema_freshness"];
  totals: {
    total_cost_krw: number;
    total_vm_confirmed_payment_success_amount_krw: number;
    total_landing_rows: number;
  };
  by_site: SiteSummary[];
  daily_rows: Array<{
    site: string;
    date: string;
    cost_krw: number;
    landing_rows: number;
    vm_confirmed_payment_success_rows: number;
    vm_confirmed_payment_success_amount_krw: number;
  }>;
  invariants_held: Record<string, unknown>;
};

const usage = () => `
Usage:
  npx tsx scripts/naver-brandsearch-roas-preview.ts [options]

Options:
  --since=YYYY-MM-DD              Inclusive KST date. Default: 2026-05-11
  --until=YYYY-MM-DD              Inclusive KST date. Default: today in KST
  --sites=biocom,thecleancoffee   Comma-separated sites. Default: biocom,thecleancoffee
  --output=path                   Write JSON output to path
  --json                          Print JSON only
  --vm-host=host                  VM Cloud host. Default: ${DEFAULT_VM_HOST}
  --vm-user=user                  SSH user. Default: ${DEFAULT_VM_USER}
  --vm-key=path                   SSH key. Default: ${DEFAULT_VM_KEY}
  --vm-db=path                    VM SQLite path. Default: ${DEFAULT_VM_DB}
  --vm-run-as=user                sudo -u user. Default: ${DEFAULT_VM_RUN_AS}
  --help                          Show help
`;

const kstToday = (): string =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

const isDateString = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value);

const parseArgs = (argv: string[]): CliOptions => {
  const options: CliOptions = {
    since: "2026-05-11",
    until: kstToday(),
    sites: [...DEFAULT_SITES],
    output: "",
    json: false,
    vmHost: process.env.VM_CLOUD_HOST?.trim() || DEFAULT_VM_HOST,
    vmUser: process.env.VM_CLOUD_USER?.trim() || DEFAULT_VM_USER,
    vmKey: process.env.VM_CLOUD_SSH_KEY?.trim() || DEFAULT_VM_KEY,
    vmDb: process.env.VM_CLOUD_SQLITE_PATH?.trim() || DEFAULT_VM_DB,
    vmRunAs: process.env.VM_CLOUD_RUN_AS?.trim() || DEFAULT_VM_RUN_AS,
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
    if (arg.startsWith("--since=")) {
      options.since = arg.slice("--since=".length).trim();
      continue;
    }
    if (arg.startsWith("--until=")) {
      options.until = arg.slice("--until=".length).trim();
      continue;
    }
    if (arg.startsWith("--sites=")) {
      options.sites = arg
        .slice("--sites=".length)
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      continue;
    }
    if (arg.startsWith("--output=")) {
      options.output = arg.slice("--output=".length).trim();
      continue;
    }
    if (arg.startsWith("--vm-host=")) {
      options.vmHost = arg.slice("--vm-host=".length).trim();
      continue;
    }
    if (arg.startsWith("--vm-user=")) {
      options.vmUser = arg.slice("--vm-user=".length).trim();
      continue;
    }
    if (arg.startsWith("--vm-key=")) {
      options.vmKey = arg.slice("--vm-key=".length).trim();
      continue;
    }
    if (arg.startsWith("--vm-db=")) {
      options.vmDb = arg.slice("--vm-db=".length).trim();
      continue;
    }
    if (arg.startsWith("--vm-run-as=")) {
      options.vmRunAs = arg.slice("--vm-run-as=".length).trim();
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!isDateString(options.since) || !isDateString(options.until)) {
    throw new Error("since/until must be YYYY-MM-DD");
  }
  if (options.since > options.until) {
    throw new Error("since must be earlier than or equal to until");
  }
  if (options.sites.length === 0) throw new Error("At least one site is required");

  return options;
};

const pythonStringLiteral = (value: string): string => JSON.stringify(value);

const pythonArrayLiteral = (values: string[]): string => `[${values.map(pythonStringLiteral).join(", ")}]`;

const buildVmPython = (options: CliOptions): string => `
import sqlite3, json, datetime

DB = ${pythonStringLiteral(options.vmDb)}
SINCE = ${pythonStringLiteral(options.since)}
UNTIL = ${pythonStringLiteral(options.until)}
SITES = ${pythonArrayLiteral(options.sites)}
SITE_ALIASES = ${JSON.stringify(SITE_ALIASES)}

conn = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
conn.row_factory = sqlite3.Row

def rows(sql, params=()):
    return [dict(r) for r in conn.execute(sql, params).fetchall()]

def table_exists(name):
    return conn.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (name,)).fetchone() is not None

cost_table_exists = table_exists("naver_brandsearch_manual_cost_daily")
if not cost_table_exists:
    raise SystemExit(json.dumps({"ok": False, "error": "naver_brandsearch_manual_cost_daily table missing"}, ensure_ascii=False))

cost_by_site_device = rows("""
SELECT
  site,
  device,
  MIN(date) AS min_date,
  MAX(date) AS max_date,
  COUNT(*) AS row_count,
  SUM(cost_krw) AS cost_krw,
  SUM(CASE WHEN source_type='manual_contract_confirmed' THEN cost_krw ELSE 0 END) AS confirmed_cost_krw,
  SUM(CASE WHEN source_type<>'manual_contract_confirmed' THEN cost_krw ELSE 0 END) AS renewal_assumption_cost_krw
FROM naver_brandsearch_manual_cost_daily
WHERE date BETWEEN ? AND ?
  AND site IN (%s)
GROUP BY site, device
ORDER BY site, device
""" % ",".join(["?"] * len(SITES)), [SINCE, UNTIL] + SITES)

cost_by_site_date = rows("""
SELECT
  site,
  date,
  SUM(cost_krw) AS cost_krw
FROM naver_brandsearch_manual_cost_daily
WHERE date BETWEEN ? AND ?
  AND site IN (%s)
GROUP BY site, date
ORDER BY site, date
""" % ",".join(["?"] * len(SITES)), [SINCE, UNTIL] + SITES)

landing_by_site_date = rows("""
SELECT
  site,
  substr(landed_at, 1, 10) AS date,
  COUNT(*) AS landing_rows
FROM site_landing_ledger
WHERE channel_classified='naver_brandsearch'
  AND substr(landed_at, 1, 10) BETWEEN ? AND ?
  AND site IN (%s)
GROUP BY site, substr(landed_at, 1, 10)
ORDER BY site, date
""" % ",".join(["?"] * len(SITES)), [SINCE, UNTIL] + SITES)

all_aliases = []
for site in SITES:
    all_aliases.extend(SITE_ALIASES.get(site, [site]))

payment_raw = rows("""
SELECT
  lower(COALESCE(json_extract(metadata_json,'$.store'), json_extract(metadata_json,'$.site'), source, '')) AS site_hint,
  substr(approved_at, 1, 10) AS date,
  COUNT(*) AS payment_success_rows,
  SUM(COALESCE(
    CAST(json_extract(metadata_json,'$.totalAmount') AS INTEGER),
    CAST(json_extract(metadata_json,'$.value') AS INTEGER),
    CAST(json_extract(metadata_json,'$.amount') AS INTEGER),
    0
  )) AS payment_success_amount_krw
FROM attribution_ledger
WHERE touchpoint='payment_success'
  AND payment_status='confirmed'
  AND substr(approved_at, 1, 10) BETWEEN ? AND ?
  AND (
    lower(COALESCE(utm_source,'')) LIKE '%brandsearch%'
    OR lower(COALESCE(utm_medium,'')) LIKE '%brandsearch%'
    OR lower(COALESCE(utm_campaign,'')) LIKE '%brandsearch%'
    OR lower(COALESCE(utm_content,'')) LIKE '%brandsearch%'
    OR lower(COALESCE(source,'')) LIKE '%brandsearch%'
    OR lower(COALESCE(json_extract(metadata_json,'$.utm_source'),'')) LIKE '%brandsearch%'
    OR lower(COALESCE(json_extract(metadata_json,'$.utm_campaign'),'')) LIKE '%brandsearch%'
    OR lower(COALESCE(json_extract(metadata_json,'$.utmContent'),'')) LIKE '%brandsearch%'
  )
GROUP BY 1, 2
ORDER BY 1, 2
""", [SINCE, UNTIL])

payment_by_site_date = []
for row in payment_raw:
    site_hint = (row.get("site_hint") or "").lower()
    mapped_site = None
    for site in SITES:
        if site_hint in [alias.lower() for alias in SITE_ALIASES.get(site, [site])]:
            mapped_site = site
            break
    if not mapped_site:
        continue
    payment_by_site_date.append({
        "site": mapped_site,
        "date": row["date"],
        "payment_success_rows": int(row["payment_success_rows"] or 0),
        "payment_success_amount_krw": int(row["payment_success_amount_krw"] or 0),
    })

schema_freshness = {
    "cost_table_exists": cost_table_exists,
    "cost_min_date": conn.execute("SELECT COALESCE(MIN(date),'') FROM naver_brandsearch_manual_cost_daily").fetchone()[0],
    "cost_max_date": conn.execute("SELECT COALESCE(MAX(date),'') FROM naver_brandsearch_manual_cost_daily").fetchone()[0],
    "cost_rows": int(conn.execute("SELECT COUNT(*) FROM naver_brandsearch_manual_cost_daily").fetchone()[0] or 0),
    "cost_cached_at_max": conn.execute("SELECT COALESCE(MAX(cached_at),'') FROM naver_brandsearch_manual_cost_daily").fetchone()[0],
    "landing_max_landed_at": conn.execute("SELECT COALESCE(MAX(landed_at),'') FROM site_landing_ledger").fetchone()[0],
    "attribution_max_logged_at": conn.execute("SELECT COALESCE(MAX(logged_at),'') FROM attribution_ledger").fetchone()[0],
}

print(json.dumps({
    "ok": True,
    "generated_at_kst": datetime.datetime.utcnow().isoformat(timespec="seconds") + "Z",
    "requested_window": {"since": SINCE, "until": UNTIL, "timezone": "KST"},
    "schema_freshness": schema_freshness,
    "cost_by_site_device": cost_by_site_device,
    "cost_by_site_date": cost_by_site_date,
    "landing_by_site_date": landing_by_site_date,
    "payment_by_site_date": payment_by_site_date,
    "invariants_held": {
        "sqlite_mode": "read_only",
        "sqlite_write": 0,
        "backend_deploy_or_restart": 0,
        "platform_send": 0,
        "raw_identifier_selected": 0,
    },
}, ensure_ascii=False))
`;

const runVmRead = (options: CliOptions): VmPayload => {
  const python = buildVmPython(options);
  const sshTarget = `${options.vmUser}@${options.vmHost}`;
  const remoteCommand = `sudo -n -u ${options.vmRunAs} python3 -`;
  const result = spawnSync(
    "ssh",
    [
      "-i",
      options.vmKey,
      "-o",
      "IdentitiesOnly=yes",
      "-o",
      "BatchMode=yes",
      sshTarget,
      remoteCommand,
    ],
    {
      input: python,
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
    },
  );

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`VM Cloud read failed: ${result.stderr || result.stdout || `exit ${result.status}`}`);
  }
  const parsed = JSON.parse(result.stdout) as VmPayload | { ok: false; error: string };
  if (!parsed.ok) {
    const errorMessage = "error" in parsed ? parsed.error : "VM Cloud read returned ok=false";
    throw new Error(errorMessage);
  }
  return parsed;
};

const sum = <T>(rows: T[], field: keyof T): number =>
  rows.reduce((total, row) => total + Number(row[field] ?? 0), 0);

const round2 = (value: number): number => Math.round(value * 100) / 100;

const dateRange = (since: string, until: string): string[] => {
  const dates: string[] = [];
  const cursor = new Date(`${since}T00:00:00.000Z`);
  const last = new Date(`${until}T00:00:00.000Z`);
  while (cursor <= last) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
};

const buildOutput = (options: CliOptions, vm: VmPayload): Output => {
  const bySite = options.sites.map((site): SiteSummary => {
    const devices = vm.cost_by_site_device.filter((row) => row.site === site);
    const costMin = devices.reduce((min, row) => row.min_date && row.min_date < min ? row.min_date : min, options.until);
    const effectiveSince = devices.length > 0 ? (costMin > options.since ? costMin : options.since) : options.since;
    const effectiveUntil = options.until;
    const costRows = devices;
    const landingRows = vm.landing_by_site_date.filter((row) =>
      row.site === site && row.date >= effectiveSince && row.date <= effectiveUntil,
    );
    const paymentRows = vm.payment_by_site_date.filter((row) =>
      row.site === site && row.date >= effectiveSince && row.date <= effectiveUntil,
    );
    const totalCost = sum(costRows, "cost_krw");
    const revenue = sum(paymentRows, "payment_success_amount_krw");
    const roas = totalCost > 0 ? round2(revenue / totalCost) : null;
    const warnings: string[] = [];
    if (devices.length === 0) warnings.push("cost_cache_missing_for_site_window");
    if (landingRows.length === 0) warnings.push("landing_rows_missing_or_not_yet_classified_for_effective_window");
    if (paymentRows.length === 0) warnings.push("payment_success_brandsearch_marker_rows_missing_for_effective_window");
    if (site === "thecleancoffee") {
      warnings.push("thecleancoffee_landing_capture_is_recent; older site_landing rows may undercount brandsearch landings");
    }

    return {
      site,
      effective_window: { since: effectiveSince, until: effectiveUntil, timezone: "KST" },
      cost: {
        total_cost_krw: totalCost,
        confirmed_contract_cost_krw: sum(costRows, "confirmed_cost_krw"),
        renewal_assumption_cost_krw: sum(costRows, "renewal_assumption_cost_krw"),
        devices: costRows,
      },
      evidence: {
        brandsearch_landing_rows: sum(landingRows, "landing_rows"),
        vm_confirmed_payment_success_rows: sum(paymentRows, "payment_success_rows"),
        vm_confirmed_payment_success_amount_krw: revenue,
      },
      roas: {
        internal_vm_payment_success_roas: roas,
        interpretation: roas === null
          ? "브랜드검색 비용 cache가 없어 ROAS를 계산하지 않는다."
          : "VM Cloud 결제완료 marker 기준 참고 ROAS다. 예산 최종 판단에는 운영DB/Imweb 주문 정본 cross-check가 필요하다.",
      },
      source_status: {
        cost_source: "VM Cloud naver_brandsearch_manual_cost_daily manual period allocation cache",
        revenue_source: "VM Cloud attribution_ledger payment_success confirmed rows with Naver brandsearch marker",
        confidence: warnings.length === 0 ? "medium_high" : "medium",
        warnings,
      },
    };
  });

  const dailyRows = bySite.flatMap((siteSummary) => {
    const dates = dateRange(siteSummary.effective_window.since, siteSummary.effective_window.until);
    return dates.map((date) => {
      const cost = vm.cost_by_site_date.find((row) => row.site === siteSummary.site && row.date === date);
      const landing = vm.landing_by_site_date.find((row) => row.site === siteSummary.site && row.date === date);
      const payment = vm.payment_by_site_date.find((row) => row.site === siteSummary.site && row.date === date);
      return {
        site: siteSummary.site,
        date,
        cost_krw: cost?.cost_krw ?? 0,
        landing_rows: landing?.landing_rows ?? 0,
        vm_confirmed_payment_success_rows: payment?.payment_success_rows ?? 0,
        vm_confirmed_payment_success_amount_krw: payment?.payment_success_amount_krw ?? 0,
      };
    });
  });

  return {
    ok: true,
    schema_version: SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    mode: "read_only_no_send",
    requested_window: { since: options.since, until: options.until, timezone: "KST" },
    source: {
      cost_primary: "VM Cloud SQLite naver_brandsearch_manual_cost_daily",
      revenue_preview: "VM Cloud SQLite attribution_ledger confirmed payment_success with Naver brandsearch marker",
      landing_evidence: "VM Cloud SQLite site_landing_ledger channel_classified=naver_brandsearch",
      caveats: [
        "This is a no-send preview reader, not a deployed report API.",
        "VM Cloud payment_success marker revenue is separated from final operating/order-source revenue.",
        "Naver Ads claimed conversion value is not mixed into internal confirmed revenue.",
      ],
    },
    freshness: vm.schema_freshness,
    totals: {
      total_cost_krw: sum(bySite.map((row) => row.cost), "total_cost_krw"),
      total_vm_confirmed_payment_success_amount_krw: sum(bySite.map((row) => row.evidence), "vm_confirmed_payment_success_amount_krw"),
      total_landing_rows: sum(bySite.map((row) => row.evidence), "brandsearch_landing_rows"),
    },
    by_site: bySite,
    daily_rows: dailyRows,
    invariants_held: {
      ...vm.invariants_held,
      report_mode: "read_only_no_send",
      operating_db_write: 0,
      naver_ads_setting_change: 0,
      conversion_upload: 0,
    },
  };
};

const formatKrw = (value: number): string => `${Math.round(value).toLocaleString("ko-KR")}원`;

const main = () => {
  const options = parseArgs(process.argv.slice(2));
  const vm = runVmRead(options);
  const output = buildOutput(options, vm);

  if (options.output) {
    const outputPath = resolve(process.cwd(), options.output);
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
  }

  if (options.json) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  console.log("Naver brandsearch ROAS preview");
  console.log(`mode: ${output.mode}`);
  console.log(`requested_window: ${output.requested_window.since}..${output.requested_window.until} KST`);
  for (const row of output.by_site) {
    console.log(
      `${row.site}: window=${row.effective_window.since}..${row.effective_window.until} ` +
      `cost=${formatKrw(row.cost.total_cost_krw)} ` +
      `landing_rows=${row.evidence.brandsearch_landing_rows} ` +
      `payment_success=${row.evidence.vm_confirmed_payment_success_rows}/${formatKrw(row.evidence.vm_confirmed_payment_success_amount_krw)} ` +
      `roas=${row.roas.internal_vm_payment_success_roas ?? "n/a"}`,
    );
  }
  if (options.output) console.log(`output: ${options.output}`);
};

main();
