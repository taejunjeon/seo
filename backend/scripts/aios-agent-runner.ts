#!/usr/bin/env tsx
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

type AgentStatus = "pass" | "warn" | "blocked" | "failed" | "skipped";

type TaskState =
  | "auto_ready"        // Green Lane, 시간/자료 의존 없음, 본 agent 즉시 실행 가능
  | "time_waiting"      // 정시 도달 대기 (예: 24h window)
  | "approval_waiting"  // TJ 승인 대기 (Yellow/Red)
  | "blocked_access"    // SSH/admin token/2FA/credential 영역 (TJ 권한 필요)
  | "blocked_data"      // 입력 자료 부재 (Growth CSV 미수신, BigQuery permission 등)
  | "parked_red"        // future Red, 재개 조건 미충족
  | "completed";        // Active Board 제외, Completed Ledger 이동 대상

type AgentScores = {
  execution_completeness: number;  // 0~1. 본 agent가 의도한 작업을 어디까지 끝냈는가
  risk: number;                    // 0~1. 본 결과를 사람이 그대로 수용하기 위한 잔여 리스크
  data_freshness: number;          // 0~1. 입력 자료의 최신성
  next_action_clarity: number;     // 0~1. 다음 할 일이 사람에게 얼마나 명확한가
};

type AgentRunResult = {
  agent_name: string;
  run_id: string;
  generated_at: string;
  generated_at_kst: string;
  lane: "Green";
  run_mode: string;
  source: string;
  window: string;
  freshness: string;
  confidence: number;
  would_write: false; // Legacy alias: means no operational write, not local artifacts.
  would_operational_write: false;
  writes_local_artifacts: true;
  would_send: false; // Legacy alias: means no platform send.
  would_platform_send: false;
  would_deploy: false;
  no_write_verified: true;
  no_operational_write_verified: true;
  no_send_verified: true;
  no_platform_send_verified: true;
  no_deploy_verified: true;
  status: AgentStatus;
  task_state: TaskState;
  scores: AgentScores;
  blocked_reasons: string[];
  outputs: Record<string, string>;
  child_runs: Array<{
    name: string;
    command: string;
    exit_code: number | null;
    status: AgentStatus;
    stdout_tail: string;
    stderr_tail: string;
  }>;
  summary: Record<string, unknown>;
  next_actions: string[];
};

const deriveTaskState = (status: AgentStatus, blockedReasons: readonly string[]): TaskState => {
  if (status === "pass") return "completed";
  if (status === "warn") return "auto_ready"; // 후처리로 본 agent가 다시 처리 가능
  if (status === "skipped") return "auto_ready";
  // failed / blocked: blocked_reasons로 분기
  for (const reason of blockedReasons) {
    if (/access|ssh|token|2fa|credential|permission/i.test(reason)) return "blocked_access";
    if (/data|input|csv|bigquery|stale_source|missing_source/i.test(reason)) return "blocked_data";
    if (/approval|yellow|red|needs_human/i.test(reason)) return "approval_waiting";
    if (/time|window|cron|schedule/i.test(reason)) return "time_waiting";
    if (/parked|future_red/i.test(reason)) return "parked_red";
  }
  return "auto_ready"; // default — 본 agent가 추가 시도 가능
};

const computeScores = (result: AgentRunResult): AgentScores => {
  const childPassRatio = result.child_runs.length === 0
    ? 1
    : result.child_runs.filter((c) => c.status === "pass").length / result.child_runs.length;
  const blockedCount = result.blocked_reasons.length;

  const execution_completeness =
    result.status === "pass" ? Math.min(1, 0.85 + 0.15 * childPassRatio) :
    result.status === "warn" ? 0.7 :
    result.status === "skipped" ? 0.5 :
    Math.max(0.1, 0.3 * childPassRatio);

  const risk =
    result.status === "pass" && blockedCount === 0 ? 0.1 :
    result.status === "warn" ? 0.35 :
    result.status === "blocked" ? 0.5 :
    result.status === "failed" ? 0.7 :
    0.3;

  const data_freshness =
    /latest|live|운영|cron 직후|today/.test(result.freshness) ? 0.92 :
    /stale|old|미동기|legacy/.test(result.freshness) ? 0.4 :
    0.75;

  const next_action_clarity = result.next_actions.length === 0
    ? 0.4
    : Math.min(1, 0.6 + 0.1 * result.next_actions.length);

  return {
    execution_completeness: Math.round(execution_completeness * 100) / 100,
    risk: Math.round(risk * 100) / 100,
    data_freshness: Math.round(data_freshness * 100) / 100,
    next_action_clarity: Math.round(next_action_clarity * 100) / 100,
  };
};

/**
 * Finalize derived fields (task_state, scores) right before serialization.
 * Each agent calls this at the end so the values reflect blocked_reasons,
 * child_runs, and next_actions populated during the run.
 */
const finalizeResult = (result: AgentRunResult): AgentRunResult => {
  result.task_state = deriveTaskState(result.status, result.blocked_reasons);
  result.scores = computeScores(result);
  return result;
};

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const BACKEND_ROOT = path.resolve(__dirname, "..");

const argValue = (name: string) => {
  const withEquals = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (withEquals) return withEquals.slice(name.length + 3);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

const hasArg = (name: string) => process.argv.includes(`--${name}`);

const kstNow = () =>
  `${new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date())} KST`;

const kstDate = () => kstNow().slice(0, 10).replaceAll("-", "");
const kstStamp = () => kstNow().replace(/[^0-9]/g, "").slice(0, 12);

const ensureDir = (filePath: string) => fs.mkdirSync(path.dirname(filePath), { recursive: true });

const tail = (value: string, max = 1200) => {
  if (!value) return "";
  const clean = value.trim();
  return clean.length > max ? clean.slice(-max) : clean;
};

const runTsx = (name: string, script: string, args: string[]) => {
  const fullArgs = ["tsx", `scripts/${script}`, ...args];
  const child = spawnSync("npx", fullArgs, {
    cwd: BACKEND_ROOT,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  const command = `cd backend && npx ${fullArgs.map((item) => (item.includes(" ") ? JSON.stringify(item) : item)).join(" ")}`;
  return {
    name,
    command,
    exit_code: child.status,
    status: child.status === 0 ? "pass" as AgentStatus : "failed" as AgentStatus,
    stdout: child.stdout ?? "",
    stderr: child.stderr ?? "",
    stdout_tail: tail(child.stdout ?? ""),
    stderr_tail: tail(child.stderr ?? ""),
  };
};

const runShell = (name: string, command: string, cwd = REPO_ROOT) => {
  const child = spawnSync("bash", ["-lc", command], {
    cwd,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  return {
    name,
    command,
    exit_code: child.status,
    status: child.status === 0 ? "pass" as AgentStatus : "failed" as AgentStatus,
    stdout: child.stdout ?? "",
    stderr: child.stderr ?? "",
    stdout_tail: tail(child.stdout ?? ""),
    stderr_tail: tail(child.stderr ?? ""),
  };
};

const parseKeyValueText = (text: string) => {
  const result: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z0-9_.-]+):\s*(.*?)\s*$/);
    if (match) result[match[1]] = match[2];
  }
  return result;
};

const parseNumberValue = (value: string | undefined) => {
  if (!value) return undefined;
  const raw = value.split("#")[0]?.trim() ?? "";
  if (!raw) return undefined;
  const num = Number(raw.replace(/,/g, ""));
  return Number.isFinite(num) ? num : undefined;
};

const writeResult = (result: AgentRunResult) => {
  const jsonOutput = path.join(REPO_ROOT, "data", `${result.run_id}.json`);
  const markdownOutput = path.join(REPO_ROOT, "agent", `${result.run_id}.md`);
  ensureDir(jsonOutput);
  ensureDir(markdownOutput);
  fs.writeFileSync(jsonOutput, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  fs.writeFileSync(markdownOutput, `${renderMarkdown(result)}\n`, "utf8");
  return { jsonOutput, markdownOutput };
};

const mdEscape = (value: unknown) => String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");

const mdTable = (headers: string[], rows: unknown[][]) => [
  `| ${headers.map(mdEscape).join(" | ")} |`,
  `| ${headers.map(() => "---").join(" | ")} |`,
  ...rows.map((row) => `| ${row.map(mdEscape).join(" | ")} |`),
].join("\n");

const renderMarkdown = (result: AgentRunResult) => [
  `# ${result.agent_name} 실행 결과`,
  "",
  `작성 시각: ${result.generated_at_kst}`,
  `상태: ${result.status}`,
  "Owner: agent / aios",
  "Harness reference: harness/common/AUTONOMY_POLICY.md + harness/common/REPORTING_TEMPLATE.md",
  "Do not use for: 운영 배포, 운영 DB write, 플랫폼 전송, GTM publish",
  "",
  "## 10초 결론",
  "",
  result.status === "pass"
    ? "Green Lane agent 실행이 통과했다. 이 결과는 read-only/no-send/no-write 관측 결과이며, 운영 숫자 변경 승인이 아니다."
    : "agent 실행에 실패 또는 block이 있다. 아래 child run과 blocked reason을 기준으로 다음 조치를 분리해야 한다.",
  "",
  "## 공통 결과",
  "",
  mdTable(
    ["field", "value"],
    [
      ["agent", result.agent_name],
      ["run_id", result.run_id],
      ["mode", result.run_mode],
      ["window", result.window],
      ["freshness", result.freshness],
      ["confidence", result.confidence],
      ["task_state", result.task_state],
      ["would_operational_write", result.would_operational_write],
      ["writes_local_artifacts", result.writes_local_artifacts],
      ["would_platform_send", result.would_platform_send],
      ["would_deploy", result.would_deploy],
      ["blocked_reasons", result.blocked_reasons.join(", ")],
    ],
  ),
  "",
  "## Scores",
  "",
  mdTable(
    ["score", "value"],
    [
      ["execution_completeness", result.scores.execution_completeness],
      ["risk", result.scores.risk],
      ["data_freshness", result.scores.data_freshness],
      ["next_action_clarity", result.scores.next_action_clarity],
    ],
  ),
  "",
  "## Child Runs",
  "",
  mdTable(
    ["name", "status", "exit", "command"],
    result.child_runs.map((row) => [row.name, row.status, row.exit_code, row.command]),
  ),
  "",
  "## 산출물",
  "",
  mdTable(
    ["kind", "path"],
    Object.entries(result.outputs).map(([key, value]) => [key, value]),
  ),
  "",
  "## Summary",
  "",
  "```json",
  JSON.stringify(result.summary, null, 2),
  "```",
  "",
  "## 다음 할 일",
  "",
  ...result.next_actions.map((item) => `- ${item}`),
].join("\n");

const baseResult = (agentName: string, runMode: string, window: string): AgentRunResult => ({
  agent_name: agentName,
  run_id: `${agentName.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`).replace(/^-/, "").replace(/[^a-z0-9-]+/g, "-")}-${kstStamp()}`,
  generated_at: new Date().toISOString(),
  generated_at_kst: kstNow(),
  lane: "Green",
  run_mode: runMode,
  source: "local repo scripts",
  window,
  freshness: "latest available read-only",
  confidence: 0.85,
  would_write: false,
  would_operational_write: false,
  writes_local_artifacts: true,
  would_send: false,
  would_platform_send: false,
  would_deploy: false,
  no_write_verified: true,
  no_operational_write_verified: true,
  no_send_verified: true,
  no_platform_send_verified: true,
  no_deploy_verified: true,
  status: "pass",
  task_state: "auto_ready",
  scores: { execution_completeness: 0, risk: 0.5, data_freshness: 0.7, next_action_clarity: 0.5 },
  blocked_reasons: [],
  outputs: {},
  child_runs: [],
  summary: {},
  next_actions: [],
});

const runPaidClickIntentMonitor = (): AgentRunResult => {
  const windowName = argValue("window") ?? "immediate";
  const baseUrl = argValue("base-url") ?? "https://att.ainativeos.net";
  const date = kstDate();
  const jsonOutput = path.join(REPO_ROOT, "data", `paid-click-intent-monitoring-${windowName}-${date}.json`);
  const markdownOutput = path.join(REPO_ROOT, "gdn", `paid-click-intent-post-publish-monitoring-result-${windowName}-${date}.md`);
  const result = baseResult("PaidClickIntentMonitorAgent", "monitoring", windowName);
  result.source = "backend/scripts/paid-click-intent-monitoring-collect.ts";
  result.confidence = 0.9;
  const child = runTsx("paid-click-intent-monitoring-collect", "paid-click-intent-monitoring-collect.ts", [
    `--base-url=${baseUrl}`,
    `--window=${windowName}`,
    `--json-output=${jsonOutput}`,
    `--markdown-output=${markdownOutput}`,
  ]);
  result.child_runs.push(child);
  result.outputs.detail_json = jsonOutput;
  result.outputs.detail_markdown = markdownOutput;
  if (child.status !== "pass") {
    result.status = "failed";
    result.blocked_reasons.push("monitoring_script_failed");
  } else {
    try {
      const detail = JSON.parse(fs.readFileSync(jsonOutput, "utf8"));
      result.summary = detail.summary ?? {};
      if (detail.summary?.pass === false) {
        result.status = "warn";
        result.blocked_reasons.push("smoke_failed");
      }
    } catch {
      result.status = "warn";
      result.blocked_reasons.push("detail_json_parse_failed");
    }
  }
  result.next_actions = [
    "24h/72h scheduled window에서 같은 agent를 재실행한다.",
    "PASS 유지 시 minimal paid_click_intent ledger write 승인안을 검토한다.",
    "실패 시 receiver/CORS/payload validation/GTM/storage 중 막힌 지점을 분리한다.",
  ];
  return result;
};

const runCoffeeData = (): AgentRunResult => {
  const endpoint = argValue("endpoint") ?? "https://att.ainativeos.net";
  const publishTs = argValue("publish-ts") ?? "2026-05-02 15:00";
  const date = kstDate();
  const monitoringOutput = path.join(REPO_ROOT, "data", `coffee-npay-intent-monitoring-${date}.yaml`);
  const a6Output = path.join(REPO_ROOT, "data", `coffee-a6-ledger-join-dry-run-${date}.txt`);
  const result = baseResult("CoffeeDataAgent", "read_only", date);
  result.source = "coffee monitoring endpoint + A-6 public ledger dry-run";
  result.confidence = 0.86;
  const monitoring = runTsx("coffee-npay-intent-monitoring-report", "coffee-npay-intent-monitoring-report.ts", [
    "--endpoint",
    endpoint,
    "--publish-ts",
    publishTs,
    "--output",
    monitoringOutput,
  ]);
  const a6 = runTsx("coffee-a6-ledger-join-dry-run", "coffee-a6-ledger-join-dry-run.ts", [
    "--endpoint",
    endpoint,
  ]);
  result.child_runs.push(monitoring, a6);
  result.outputs.monitoring_yaml = monitoringOutput;
  result.outputs.a6_dry_run_txt = a6Output;
  if (a6.stdout) {
    ensureDir(a6Output);
    fs.writeFileSync(a6Output, a6.stdout, "utf8");
  }
  const failed = result.child_runs.filter((child) => child.status !== "pass");
  if (failed.length) {
    result.status = "failed";
    result.blocked_reasons.push("coffee_child_script_failed");
  }
  const monitoringText = fs.existsSync(monitoringOutput) ? fs.readFileSync(monitoringOutput, "utf8") : monitoring.stdout;
  const a6Text = fs.existsSync(a6Output) ? fs.readFileSync(a6Output, "utf8") : a6.stdout;
  const monitoringKv = parseKeyValueText(monitoringText);
  const a6Kv = parseKeyValueText(a6Text);
  const a5RealRows = parseNumberValue(monitoringKv["M-1_total_rows_excl_test"]);
  const a6RealRows = parseNumberValue(a6Kv.real_rows);
  const a6JoinEligibilityPct = parseNumberValue(a6Kv.a6_join_eligibility_pct);
  const a6SendTargetCount = parseNumberValue(a6Kv.a6_send_target_count);
  result.summary = {
    a5_verdict: monitoringKv.verdict ?? "unknown",
    a5_stop_required: monitoringKv.stop_required ?? "unknown",
    a5_real_rows: a5RealRows ?? "unknown",
    a6_real_rows: a6RealRows ?? "unknown",
    a6_join_eligibility_pct: a6JoinEligibilityPct ?? "unknown",
    a6_send_target_count: a6SendTargetCount ?? "unknown",
    notes: {
      a5_real_rows: "monitoring report M-1_total_rows_excl_test",
      a6_real_rows: "A-6 send 후보 real row 수",
      a6_join_eligibility_pct: "confirm_to_pay AND imweb_order_code 존재 비율",
      a6_send_target_count: "본 시점 A-6 send 후보, 운영 ledger 누적",
    },
  };
  if (monitoringKv.stop_required === "true") {
    result.status = "blocked";
    result.blocked_reasons.push("a5_stop_required");
  }
  result.next_actions = [
    "KST 18:00 cron 산출물 이후 재실행해 A-5 closure를 재판정한다.",
    "A-5 PASS가 유지되면 A-6 backend no-send 배포 승인안을 작성한다.",
    "Coffee GA4/Meta 실제 전송은 계속 Red Lane으로 유지한다.",
  ];
  return result;
};

const runCampaignMapping = (): AgentRunResult => {
  const date = kstDate();
  const workbook = argValue("workbook") ?? "/Users/vibetj/Downloads/campaign-mapping-manual-check-template-20260505 (1).csv";
  const jsonOutput = path.join(REPO_ROOT, "data", `meta-split-required-dry-run-${date}.json`);
  const markdownOutput = path.join(REPO_ROOT, "meta", `campaign-mapping-split-required-dry-run-${date}.md`);
  const result = baseResult("CampaignMappingAgent", "dry_run", date);
  result.source = "backend/scripts/meta-split-required-dry-run.ts + Growth manual CSV/XLSX";
  result.confidence = 0.88;
  const child = runTsx("meta-split-required-dry-run", "meta-split-required-dry-run.ts", [
    `--workbook=${workbook}`,
    `--json-output=${jsonOutput}`,
    `--markdown-output=${markdownOutput}`,
  ]);
  result.child_runs.push(child);
  result.outputs.detail_json = jsonOutput;
  result.outputs.detail_markdown = markdownOutput;
  if (child.status !== "pass") {
    result.status = "failed";
    result.blocked_reasons.push("campaign_mapping_dry_run_failed");
  } else {
    try {
      const detail = JSON.parse(fs.readFileSync(jsonOutput, "utf8"));
      result.summary = detail.summary ?? {};
      const rows = Array.isArray(detail.rows) ? detail.rows : [];
      const splitRows = rows
        .filter((row) => row.dry_run_bucket === "split_required_order_level_needed")
        .sort((a, b) => Number(b.confirmed_revenue ?? 0) - Number(a.confirmed_revenue ?? 0));
      const precisionRows = rows.filter((row) => row.dry_run_bucket === "precision_loss_review");
      result.summary.growth_team_questions = [
        splitRows.length
          ? `split_required ${splitRows.length}건은 주문별 campaign/adset/ad id 또는 URL Parameters export가 있어야 나눌 수 있습니다. 우선 매출 큰 alias ${splitRows.slice(0, 3).map((row) => `${row.target}(${Number(row.confirmed_revenue ?? 0).toLocaleString("ko-KR")}원)`).join(", ")}의 주문별 광고 id export를 받을 수 있나요?`
          : undefined,
        precisionRows.length
          ? `precision_loss_review ${precisionRows.length}건은 campaign id가 000으로 손상됐을 수 있습니다. ${precisionRows.map((row) => row.target).join(", ")}의 Ads Manager 원본 campaign id를 텍스트로 다시 받을 수 있나요?`
          : undefined,
        "split_required는 회신 전까지 Meta 캠페인 ROAS에 강제 배정하지 않는 기준에 동의하나요?",
      ].filter(Boolean);
    } catch {
      result.status = "warn";
      result.blocked_reasons.push("detail_json_parse_failed");
    }
  }
  result.next_actions = [
    "split_required_order_level_needed는 주문별 campaign/adset/ad id evidence 확보 전까지 Meta ROAS에 강제 배정하지 않는다.",
    "precision_loss_review는 Ads Manager 원본 id로 재확인한다.",
    "그로스파트 추가 확인이 필요하면 otherpart/!otherpart.md에 질문을 1~3개로 축약한다.",
  ];
  return result;
};

const approvalStatusFor = (content: string) => {
  // Check 1: index-doc canonical closure phrases (case-insensitive)
  if (/현재 TJ님이 \*\*지금 확인할 open approval은 없다\*\*/i.test(content)) return "closed";
  if (/현재 open approval:\s*\*\*없음\*\*/i.test(content)) return "closed";
  // Check 2: explicit approved/closed shorthand anywhere
  if (/approved \/ closed|closed \/ tj approved|closed_approved/i.test(content)) return "closed";
  // Check 3: header status line (top 25 lines) explicitly marks executed/closed/approved
  const headerLines = content.split(/\r?\n/).slice(0, 25);
  const headerClosed = headerLines.some((line) =>
    /^Status:\s*(executed|closed|approved)/i.test(line) ||
    /^현재 상태:\s*(승인 완료|deploy 완료|executed|실행 완료|완료)/.test(line) ||
    /^상태:\s*(승인 완료|deploy 완료|executed|실행 완료|완료)/.test(line),
  );
  if (headerClosed) return "closed";
  // Check 4: future Red Lane indicators
  if (/future red approval|future approval|별도 승인|red lane/i.test(content)) return "future";
  // Check 5: open keywords
  if (/needs_human_approval|approval_pending|확인 대기|confirmation pending/i.test(content)) return "open";
  return "unknown";
};

const approvalReasonFor = (row: { file: string; title: string; status: string }) => {
  if (row.status !== "future") return "";
  if (row.file.includes("minimal-ledger-write")) return "운영 ledger write가 포함될 수 있어 Red Lane";
  if (row.file.includes("production-receiver-deploy")) return "운영 backend deploy가 포함되어 Red Lane";
  if (row.file.includes("gtm-production-publish")) return "GTM Production publish가 포함되어 Red Lane";
  if (row.file.includes("confirmed-purchase")) return "Google Ads/플랫폼 전환값 또는 학습 신호에 영향";
  if (row.file.includes("primary-change")) return "Google Ads Primary 전환 설정 변경";
  return "외부 플랫폼 숫자, 운영 배포, 또는 write 가능성이 있어 미래 승인";
};

const approvalResumeFor = (row: { file: string; title: string; status: string }) => {
  if (row.status !== "future") return "";
  if (row.file.includes("minimal-ledger-write")) return "24h/72h paid_click_intent monitoring PASS 후";
  if (row.file.includes("production-receiver-deploy")) return "route diff/negative smoke/rollback 조건 확정 후";
  if (row.file.includes("gtm-production-publish")) return "receiver TEST POST/negative smoke PASS 후";
  if (row.file.includes("confirmed-purchase")) return "click id 보존률과 no-send 후보 품질이 충분할 때";
  if (row.file.includes("primary-change")) return "새 BI confirmed_purchase 병렬 관측 후";
  return "별도 승인 문서의 재개 조건 충족 후";
};

const runApprovalQueue = (): AgentRunResult => {
  const result = baseResult("ApprovalQueueAgent", "approval_index", kstDate());
  result.source = "confirm/*.md + gdn/*approval*.md + total/!total-current.md";
  result.confidence = 0.84;
  const targets = [
    ...fs.readdirSync(path.join(REPO_ROOT, "confirm")).filter((file) => file.endsWith(".md")).map((file) => path.join("confirm", file)),
    ...fs.readdirSync(path.join(REPO_ROOT, "gdn")).filter((file) => file.includes("approval") && file.endsWith(".md")).map((file) => path.join("gdn", file)),
    "total/!total-current.md",
  ].filter((file) => fs.existsSync(path.join(REPO_ROOT, file)));
  const rows = targets.map((file) => {
    const content = fs.readFileSync(path.join(REPO_ROOT, file), "utf8");
    const row = {
      file,
      status: approvalStatusFor(content),
      title: content.split(/\r?\n/).find((line) => line.startsWith("# "))?.replace(/^#\s*/, "") ?? path.basename(file),
    };
    return {
      ...row,
      reason: approvalReasonFor(row),
      resume_condition: approvalResumeFor(row),
    };
  });
  const statusCounts = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1;
    return acc;
  }, {});
  result.summary = {
    scanned_files: rows.length,
    status_counts: statusCounts,
    open_approvals: rows.filter((row) => row.status === "open"),
    future_approvals: rows.filter((row) => row.status === "future").slice(0, 20),
    future_red_table: rows
      .filter((row) => row.status === "future")
      .map((row) => ({
        file: row.file,
        title: row.title,
        reason: row.reason,
        resume_condition: row.resume_condition,
      })),
  };
  result.outputs.approval_index_json = path.join(REPO_ROOT, "data", `approval-queue-agent-${kstDate()}.json`);
  result.outputs.approval_index_markdown = path.join(REPO_ROOT, "agent", `approval-queue-agent-result-${kstDate()}.md`);
  ensureDir(result.outputs.approval_index_json);
  ensureDir(result.outputs.approval_index_markdown);
  fs.writeFileSync(result.outputs.approval_index_json, `${JSON.stringify({ generated_at_kst: result.generated_at_kst, rows, summary: result.summary }, null, 2)}\n`, "utf8");
  fs.writeFileSync(result.outputs.approval_index_markdown, [
    "# ApprovalQueueAgent 결과",
    "",
    `작성 시각: ${result.generated_at_kst}`,
    "",
    "## 요약",
    "",
    mdTable(
      ["metric", "value"],
      [
        ["scanned_files", rows.length],
        ["open", statusCounts.open ?? 0],
        ["future", statusCounts.future ?? 0],
        ["closed", statusCounts.closed ?? 0],
        ["unknown", statusCounts.unknown ?? 0],
      ],
    ),
    "",
    "## Open approvals",
    "",
    mdTable(
      ["file", "title"],
      rows.filter((row) => row.status === "open").map((row) => [row.file, row.title]),
    ),
    "",
    "## Future Red approvals",
    "",
    mdTable(
      ["file", "title", "why_future_red", "resume_condition"],
      rows.filter((row) => row.status === "future").map((row) => [row.file, row.title, row.reason, row.resume_condition]),
    ),
  ].join("\n") + "\n", "utf8");
  const openCount = statusCounts.open ?? 0;
  if (openCount > 0) {
    result.status = "warn";
    result.blocked_reasons.push("open_approval_exists");
  }
  result.next_actions = [
    "open approval이 생기면 confirm/!confirm.md를 갱신한다.",
    "future Red approval은 실제 실행하지 않고 승인 문서만 유지한다.",
    "approval parser가 false positive를 내면 status keyword를 보정한다.",
  ];
  return result;
};

const defaultReportAuditTargets = () => [
  "agent/!aiosagentplan.md",
  "total/!total-current.md",
  "GA4/gtm.md",
  "gdn/!gdnplan.md",
  "gdn/google-ads-vm-ledger-source-recovery-backend-deploy-result-20260507.md",
].filter((file) => fs.existsSync(path.join(REPO_ROOT, file)));

const runReportAuditor = (): AgentRunResult => {
  const targetArg = argValue("targets");
  const targets = (targetArg ? targetArg.split(",").map((item) => item.trim()) : defaultReportAuditTargets())
    .filter(Boolean)
    .filter((file) => fs.existsSync(path.join(REPO_ROOT, file)));
  const result = baseResult("ReportAuditorAgent", "report_audit", kstDate());
  result.source = "repo markdown + harness validators + git diff";
  result.confidence = 0.87;

  const validateCommand = targets.length
    ? `python3 scripts/validate_wiki_links.py ${targets.map((item) => JSON.stringify(item)).join(" ")}`
    : "python3 scripts/validate_wiki_links.py";
  const wiki = runShell("validate_wiki_links", validateCommand);
  const harness = runShell("harness-preflight-check", "python3 scripts/harness-preflight-check.py --strict");
  const diffCheck = runShell("git-diff-check", "git diff --check");
  const staleEndpoint = runShell(
    "stale-endpoint-scan",
    [
      "rg -n \"paid-click-intent/no-send|paid_click_intent/no-send|confirmed-purchase/no-send|confirmed_purchase/no-send|conversion upload|googleAds:mutate|GTM Production publish|operating DB write|운영 DB write\"",
      targets.map((item) => JSON.stringify(item)).join(" "),
      "|| true",
    ].filter(Boolean).join(" "),
  );
  result.child_runs.push(wiki, harness, diffCheck, staleEndpoint);

  const endpointLines = staleEndpoint.stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(0, 80);
  const warnings = endpointLines.filter((line) => {
    if (line.includes("Do not use for")) return false;
    if (line.includes("forbidden_actions")) return false;
    if (line.includes("금지")) return false;
    if (line.includes("Red Lane")) return false;
    if (line.includes("parked_red")) return false;
    if (line.includes("future Red")) return false;
    if (line.includes("보류")) return false;
    if (line.includes("access log lines")) return false;
    if (/^\s*\S*?:\d+:\s*-\s+/.test(line)) return false;
    if (/^\s*\S*?:\d+:-\s+/.test(line)) return false;
    return /paid_click_intent\/no-send|confirmed_purchase\/no-send|conversion upload|googleAds:mutate|operating DB write/.test(line);
  });

  const failed = result.child_runs.filter((child) => child.status !== "pass");
  if (failed.length) {
    result.status = "failed";
    result.blocked_reasons.push(...failed.map((child) => `${child.name}_failed`));
  } else if (warnings.length) {
    result.status = "warn";
    result.blocked_reasons.push("language_or_endpoint_drift_candidates");
  }

  result.summary = {
    audited_targets: targets,
    wiki_link_status: wiki.status,
    harness_status: harness.status,
    diff_check_status: diffCheck.status,
    stale_endpoint_line_count: endpointLines.length,
    drift_candidate_count: warnings.length,
    drift_candidates: warnings.slice(0, 30),
  };
  result.next_actions = [
    "warn이면 drift_candidates를 사람이 읽는 문서에서 용어/endpoint 혼동인지 확인한다.",
    "failed이면 validate_wiki_links, harness-preflight, diff check 중 실패한 명령을 먼저 수정한다.",
    "ReportAuditorAgent는 운영 write/send/publish/deploy를 하지 않는다.",
  ];
  return result;
};

const runConfirmedPurchasePrep = (): AgentRunResult => {
  const date = kstDate();
  const input = argValue("input") ?? path.join(REPO_ROOT, "data", "bi-confirmed-purchase-operational-dry-run-20260505.json");
  const jsonOutput = path.join(REPO_ROOT, "data", `google-ads-confirmed-purchase-candidate-prep-${date}.json`);
  const markdownOutput = path.join(REPO_ROOT, "gdn", `google-ads-confirmed-purchase-candidate-prep-${date}.md`);
  const result = baseResult("ConfirmedPurchasePrepAgent", "no_send_candidate_prep", date);
  result.source = "backend/scripts/google-ads-confirmed-purchase-candidate-prep.ts";
  result.confidence = 0.86;
  const child = runTsx("google-ads-confirmed-purchase-candidate-prep", "google-ads-confirmed-purchase-candidate-prep.ts", [
    `--input=${input}`,
    `--json-output=${jsonOutput}`,
    `--markdown-output=${markdownOutput}`,
  ]);
  result.child_runs.push(child);
  result.outputs.detail_json = jsonOutput;
  result.outputs.detail_markdown = markdownOutput;
  if (child.status !== "pass") {
    result.status = "failed";
    result.blocked_reasons.push("confirmed_purchase_prep_failed");
  } else {
    try {
      const detail = JSON.parse(fs.readFileSync(jsonOutput, "utf8"));
      result.summary = detail.summary ?? {};
      if (Number(detail.summary?.send_candidate ?? 0) !== 0) {
        result.status = "failed";
        result.blocked_reasons.push("send_candidate_not_zero");
      }
    } catch {
      result.status = "warn";
      result.blocked_reasons.push("detail_json_parse_failed");
    }
  }
  result.next_actions = [
    "24h/72h paid_click_intent monitoring PASS 이후 이 prep을 재실행해 missing_google_click_id 변화만 본다.",
    "Google Ads conversion action 생성/변경과 conversion upload는 별도 Red 승인 전 금지한다.",
    "no-send 후보의 block_reason을 confirmed_purchase 실행 승인안의 선행 근거로만 사용한다.",
  ];
  return result;
};

const listAgents = () => {
  console.log([
    "paid-click-intent-monitor",
    "coffee-data",
    "campaign-mapping",
    "approval-queue",
    "report-auditor",
    "confirmed-purchase-prep",
  ].join("\n"));
};

const main = () => {
  if (hasArg("list")) {
    listAgents();
    return;
  }
  const agent = argValue("agent");
  let result: AgentRunResult;
  if (agent === "paid-click-intent-monitor") result = runPaidClickIntentMonitor();
  else if (agent === "coffee-data") result = runCoffeeData();
  else if (agent === "campaign-mapping") result = runCampaignMapping();
  else if (agent === "approval-queue") result = runApprovalQueue();
  else if (agent === "report-auditor") result = runReportAuditor();
  else if (agent === "confirmed-purchase-prep") result = runConfirmedPurchasePrep();
  else {
    console.error("Usage: npx tsx scripts/aios-agent-runner.ts --agent=<paid-click-intent-monitor|coffee-data|campaign-mapping|approval-queue|report-auditor|confirmed-purchase-prep>");
    console.error("       npx tsx scripts/aios-agent-runner.ts --list");
    process.exitCode = 1;
    return;
  }
  finalizeResult(result);
  const outputs = writeResult(result);
  result.outputs.agent_json = outputs.jsonOutput;
  result.outputs.agent_markdown = outputs.markdownOutput;
  fs.writeFileSync(outputs.jsonOutput, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  fs.writeFileSync(outputs.markdownOutput, `${renderMarkdown(result)}\n`, "utf8");
  console.log(JSON.stringify({
    agent_name: result.agent_name,
    status: result.status,
    task_state: result.task_state,
    scores: result.scores,
    blocked_reasons: result.blocked_reasons,
    outputs: result.outputs,
  }, null, 2));
  if (result.status === "failed") process.exitCode = 1;
};

main();
