#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const DEFAULT_BASE_URL = "https://att.ainativeos.net";
const DEFAULT_REPO_ROOT = path.resolve(__dirname, "..", "..");

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    baseUrl: process.env.ATTRIBUTION_BASE_URL || DEFAULT_BASE_URL,
    repoRoot: process.env.SEO_REPO_ROOT || DEFAULT_REPO_ROOT,
    label: "manual",
    windowHours: 24,
    notify: true,
    appendFetchResult: true,
    selfRemovePlist: "",
  };

  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];
    const value = args[index + 1];
    if (!key.startsWith("--")) continue;
    const name = key.slice(2);
    if (name === "noNotify") {
      options.notify = false;
      continue;
    }
    if (name === "noAppendFetchResult") {
      options.appendFetchResult = false;
      continue;
    }
    if (value === undefined) continue;
    if (name === "baseUrl") options.baseUrl = value;
    if (name === "repoRoot") options.repoRoot = value;
    if (name === "label") options.label = value;
    if (name === "windowHours") options.windowHours = Number(value);
    if (name === "notify") options.notify = value !== "false";
    if (name === "appendFetchResult") options.appendFetchResult = value !== "false";
    if (name === "selfRemovePlist") options.selfRemovePlist = value;
    index += 1;
  }

  options.baseUrl = options.baseUrl.replace(/\/+$/, "");
  if (!Number.isFinite(options.windowHours) || options.windowHours <= 0) {
    throw new Error(`invalid --windowHours: ${options.windowHours}`);
  }
  return options;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      origin: "https://biocom.kr",
    },
  });
  const text = await response.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch (error) {
    body = { raw: text, parseError: error.message };
  }
  return {
    ok: response.ok,
    status: response.status,
    body,
  };
}

function countBy(items, pick) {
  const result = {};
  for (const item of items) {
    const value = pick(item) || "(none)";
    result[value] = (result[value] || 0) + 1;
  }
  return result;
}

function groupByOrder(items) {
  const groups = new Map();
  for (const item of items) {
    const key = item.orderCode || item.orderNo || item.eventId || "(unknown)";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return groups;
}

function formatCounts(counts) {
  const entries = Object.entries(counts || {}).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (entries.length === 0) return "- none";
  return entries.map(([key, value]) => `- ${key}: ${value}`).join("\n");
}

function uniqueCsv(values) {
  return [...new Set(values.filter(Boolean))].join(", ") || "-";
}

function analyze(items, health) {
  const anomalies = [];
  const warnings = [];
  if (!health.ok || health.status >= 400 || health.body?.ok === false) {
    anomalies.push(`health endpoint failed: status=${health.status}`);
  }

  const groups = groupByOrder(items);
  const releasedBad = items.filter(
    (item) =>
      item.action === "released_confirmed_purchase" &&
      (item.decisionStatus !== "confirmed" || item.decisionBranch !== "allow_purchase"),
  );
  const unknownReleased = items.filter((item) => item.action === "released_unknown_purchase");
  const blockedBad = items.filter(
    (item) =>
      item.action === "blocked_pending_purchase" &&
      (item.decisionStatus !== "pending" || item.decisionBranch !== "block_purchase_virtual_account"),
  );

  if (releasedBad.length) {
    anomalies.push(`released_confirmed_purchase anomaly rows=${releasedBad.length}`);
  }
  if (unknownReleased.length) {
    warnings.push(`released_unknown_purchase rows=${unknownReleased.length}`);
  }
  if (blockedBad.length) {
    warnings.push(`blocked_pending_purchase non-standard rows=${blockedBad.length}`);
  }

  for (const [orderKey, events] of groups.entries()) {
    const actions = new Set(events.map((event) => event.action));
    if (actions.has("purchase_intercepted")) {
      const hasFinal =
        actions.has("released_confirmed_purchase") ||
        actions.has("released_unknown_purchase") ||
        actions.has("blocked_pending_purchase");
      if (!hasFinal) warnings.push(`missing final action for order=${orderKey}`);
    }
    if (actions.has("sent_replacement_place_an_order") && !actions.has("blocked_pending_purchase")) {
      warnings.push(`replacement without blocked_pending_purchase for order=${orderKey}`);
    }
  }

  return { anomalies, warnings, groups };
}

function buildOrderRows(groups) {
  const rows = [...groups.entries()]
    .map(([orderKey, events]) => {
      const latest = events
        .slice()
        .sort((a, b) => String(b.loggedAt || "").localeCompare(String(a.loggedAt || "")))[0];
      return {
        orderKey,
        loggedAt: latest?.loggedAt || "-",
        orderNo: uniqueCsv(events.map((event) => event.orderNo)),
        paymentCode: uniqueCsv(events.map((event) => event.paymentCode)),
        value: uniqueCsv(events.map((event) => String(event.value ?? ""))),
        actions: uniqueCsv(events.map((event) => event.action)),
        statuses: uniqueCsv(events.map((event) => event.decisionStatus)),
        branches: uniqueCsv(events.map((event) => event.decisionBranch)),
      };
    })
    .sort((a, b) => String(b.loggedAt).localeCompare(String(a.loggedAt)))
    .slice(0, 30);

  if (!rows.length) return "| order | logged_at | actions |\n|---|---:|---|\n| none | - | - |";
  return [
    "| order | logged_at | order_no | value | actions | decision |",
    "|---|---:|---:|---:|---|---|",
    ...rows.map(
      (row) =>
        `| ${row.orderKey} | ${row.loggedAt} | ${row.orderNo} | ${row.value} | ${row.actions} | ${row.statuses} / ${row.branches} |`,
    ),
  ].join("\n");
}

function buildMarkdown({ options, generatedAt, startAt, endAt, health, eventData, analysis }) {
  const items = Array.isArray(eventData.body?.items) ? eventData.body.items : [];
  const summary = eventData.body?.summary || {};
  const title = `TikTok Guard Monitor ${options.label}`;
  const status =
    analysis.anomalies.length > 0 ? "FAIL" : analysis.warnings.length > 0 ? "WARN" : "PASS";

  return `# ${title}

- generated_at: ${generatedAt.toISOString()}
- window: ${startAt.toISOString()} ~ ${endAt.toISOString()}
- base_url: ${options.baseUrl}
- source: 운영 VM API / CRM_LOCAL_DB_PATH#tiktok_pixel_events
- status: ${status}
- confidence: ${analysis.anomalies.length ? "70%" : analysis.warnings.length ? "90%" : "99%"}

## API

- health_status: ${health.status}
- health_ok: ${health.ok && health.body?.ok !== false}
- events_status: ${eventData.status}
- events_ok: ${eventData.ok && eventData.body?.ok !== false}

## Summary

- totalEvents: ${summary.totalEvents ?? items.length}
- uniqueOrderKeys: ${summary.uniqueOrderKeys ?? analysis.groups.size}

### countsByAction

${formatCounts(summary.countsByAction || countBy(items, (item) => item.action))}

### countsByDecisionStatus

${formatCounts(summary.countsByDecisionStatus || countBy(items, (item) => item.decisionStatus))}

### countsByDecisionBranch

${formatCounts(summary.countsByDecisionBranch || countBy(items, (item) => item.decisionBranch))}

## Anomalies

${analysis.anomalies.length ? analysis.anomalies.map((item) => `- ${item}`).join("\n") : "- none"}

## Warnings

${analysis.warnings.length ? analysis.warnings.map((item) => `- ${item}`).join("\n") : "- none"}

## Recent Orders

${buildOrderRows(analysis.groups)}

## Interpretation

- PASS means the v2 guard ledger has no detected release/block inconsistency in this window.
- A zero-event PASS means no TikTok Purchase interception was observed in the window, not that ads generated no traffic.
- Business ROAS 판단은 이 원장만으로 끝내지 말고 TikTok Ads export, 아임웹/토스 주문, GA4를 함께 대조한다.
`;
}

function appendFetchResult(repoRoot, markdownPath, label, status, generatedAt) {
  const target = path.join(repoRoot, "tiktok", "fetchresult.md");
  const relative = path.relative(repoRoot, markdownPath);
  const block = `

## ${generatedAt.toISOString().slice(0, 10)} TikTok Guard 자동 모니터링 ${label}

- status: ${status}
- report: \`${relative}\`
- source: 운영 VM API / CRM_LOCAL_DB_PATH#tiktok_pixel_events
`;
  fs.appendFileSync(target, block, "utf8");
}

function notify(title, message) {
  const safeTitle = title.replace(/"/g, '\\"');
  const safeMessage = message.replace(/"/g, '\\"');
  spawnSync("osascript", [
    "-e",
    `display notification "${safeMessage}" with title "${safeTitle}"`,
  ]);
}

function scheduleSelfRemoval(plistPath) {
  if (!plistPath) return;
  const uid = process.getuid ? process.getuid() : "";
  const quoted = plistPath.replace(/'/g, "'\\''");
  const command = `(sleep 3; launchctl bootout gui/${uid} '${quoted}' >/dev/null 2>&1; rm -f '${quoted}') >/dev/null 2>&1 &`;
  spawnSync("/bin/zsh", ["-lc", command], { stdio: "ignore" });
}

async function main() {
  const options = parseArgs();
  const generatedAt = new Date();
  const endAt = generatedAt;
  const startAt = new Date(endAt.getTime() - options.windowHours * 60 * 60 * 1000);
  const repoRoot = path.resolve(options.repoRoot);
  const reportDir = path.join(repoRoot, "tiktok", "monitoring");
  fs.mkdirSync(reportDir, { recursive: true });

  const eventUrl =
    `${options.baseUrl}/api/attribution/tiktok-pixel-events` +
    `?startAt=${encodeURIComponent(startAt.toISOString())}` +
    `&endAt=${encodeURIComponent(endAt.toISOString())}` +
    `&limit=10000`;

  const [health, eventData] = await Promise.all([
    fetchJson(`${options.baseUrl}/health`),
    fetchJson(eventUrl),
  ]);
  const items = Array.isArray(eventData.body?.items) ? eventData.body.items : [];
  const analysis = analyze(items, health);
  const status =
    analysis.anomalies.length > 0 ? "FAIL" : analysis.warnings.length > 0 ? "WARN" : "PASS";
  const markdown = buildMarkdown({
    options,
    generatedAt,
    startAt,
    endAt,
    health,
    eventData,
    analysis,
  });

  const stamp = generatedAt.toISOString().replace(/[:.]/g, "-");
  const markdownPath = path.join(reportDir, `tiktok_guard_monitor_${options.label}_${stamp}.md`);
  const jsonPath = path.join(reportDir, `tiktok_guard_monitor_${options.label}_${stamp}.json`);
  fs.writeFileSync(markdownPath, markdown, "utf8");
  fs.writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        generatedAt: generatedAt.toISOString(),
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        status,
        health,
        eventData,
        anomalies: analysis.anomalies,
        warnings: analysis.warnings,
      },
      null,
      2,
    ),
    "utf8",
  );

  if (options.appendFetchResult) {
    appendFetchResult(repoRoot, markdownPath, options.label, status, generatedAt);
  }
  if (options.notify) {
    notify(
      `TikTok Guard ${options.label}: ${status}`,
      `events=${items.length}, anomalies=${analysis.anomalies.length}, report=${path.basename(markdownPath)}`,
    );
  }

  console.log(
    JSON.stringify(
      {
        ok: status !== "FAIL",
        status,
        label: options.label,
        windowHours: options.windowHours,
        eventCount: items.length,
        anomalyCount: analysis.anomalies.length,
        warningCount: analysis.warnings.length,
        markdownPath,
        jsonPath,
      },
      null,
      2,
    ),
  );

  scheduleSelfRemoval(options.selfRemovePlist);
  if (status === "FAIL") process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  notify("TikTok Guard monitor failed", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
