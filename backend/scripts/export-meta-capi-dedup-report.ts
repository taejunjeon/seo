import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  buildMetaCapiDedupCandidateDetails,
  buildMetaCapiLogDiagnostics,
  classifyMetaCapiLogSegment,
  readMetaCapiSendLogs,
  type MetaCapiDedupCandidateDetail,
  type MetaCapiSendLogRecord,
} from "../src/metaCapi";

type Options = {
  days: number;
  since: string;
  until: string;
  limit: number;
  outPrefix: string;
};

const REPO_ROOT = path.resolve(__dirname, "..", "..");

const parsePositiveInt = (value: string | undefined, fallback: number) => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const parseArgs = (): Options => {
  const args = process.argv.slice(2);
  const options: Options = {
    days: 3,
    since: "",
    until: "",
    limit: 50,
    outPrefix: path.resolve(REPO_ROOT, "data", `meta_capi_dedup_phase4_${todayKstCompact()}`),
  };

  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];
    const value = args[index + 1];
    if (!key?.startsWith("--")) continue;
    if (key === "--days" && value) {
      options.days = parsePositiveInt(value, options.days);
      index += 1;
      continue;
    }
    if (key === "--since" && value) {
      options.since = value;
      index += 1;
      continue;
    }
    if (key === "--until" && value) {
      options.until = value;
      index += 1;
      continue;
    }
    if (key === "--limit" && value) {
      options.limit = parsePositiveInt(value, options.limit);
      index += 1;
      continue;
    }
    if (key === "--out-prefix" && value) {
      options.outPrefix = path.isAbsolute(value) ? value : path.resolve(REPO_ROOT, value);
      index += 1;
    }
  }

  return options;
};

function todayKstCompact() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()).replaceAll("-", "");
}

const toTimestampMs = (value: string) => {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid ISO timestamp: ${value}`);
  }
  return parsed;
};

const toKst = (value: string) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(parsed).replace(" ", " ");
};

const filterOperationalSuccessLogs = (logs: MetaCapiSendLogRecord[], options: Options) => {
  const sinceMs = options.since
    ? toTimestampMs(options.since)
    : Date.now() - options.days * 24 * 60 * 60 * 1000;
  const untilMs = toTimestampMs(options.until);

  return logs.filter((row) => {
    if (classifyMetaCapiLogSegment(row) !== "operational") return false;
    if (row.response_status < 200 || row.response_status >= 300) return false;

    const timestampMs = Date.parse(row.timestamp);
    if (!Number.isFinite(timestampMs)) return false;
    if (sinceMs !== null && timestampMs < sinceMs) return false;
    if (untilMs !== null && timestampMs > untilMs) return false;
    return true;
  });
};

const collectEventIds = (details: MetaCapiDedupCandidateDetail[]) =>
  [...new Set(details.flatMap((detail) => detail.rows.map((row) => row.eventId).filter(Boolean)))];

const renderCandidateTable = (details: MetaCapiDedupCandidateDetail[], maxRows: number) => {
  if (details.length === 0) return "\n없음\n";

  const lines = [
    "| orderId | event | rows | unique event_id | first sent KST | last sent KST | event_id sample |",
    "|---|---|---:|---:|---|---|---|",
  ];

  for (const detail of details.slice(0, maxRows)) {
    const eventIds = collectEventIds([detail]).slice(0, 2).join("<br>");
    lines.push(
      `| ${detail.orderId} | ${detail.eventName} | ${detail.count} | ${detail.uniqueEventIds} | ${toKst(detail.firstSentAt)} | ${toKst(detail.lastSentAt)} | ${eventIds} |`,
    );
  }

  return `\n${lines.join("\n")}\n`;
};

const renderDetailRows = (detail: MetaCapiDedupCandidateDetail) => {
  const lines = [
    "| sent KST | event_id | status | path | paymentKey | approvedAt KST | loggedAt KST |",
    "|---|---|---:|---|---|---|---|",
  ];

  for (const row of detail.rows) {
    lines.push(
      `| ${toKst(row.createdAt)} | ${row.eventId} | ${row.responseStatus} | ${row.sendPath} | ${row.paymentKey} | ${toKst(row.approvedAt)} | ${toKst(row.loggedAt)} |`,
    );
  }

  return lines.join("\n");
};

const renderMarkdown = (params: {
  generatedAt: string;
  options: Options;
  summary: ReturnType<typeof buildMetaCapiLogDiagnostics>;
  multiEventIdDetails: MetaCapiDedupCandidateDetail[];
  retryLikeDetails: MetaCapiDedupCandidateDetail[];
}) => {
  const { generatedAt, options, summary, multiEventIdDetails, retryLikeDetails } = params;
  const highRisk = multiEventIdDetails[0];

  return `# Meta CAPI Dedup Phase 4 Report

작성 시각: ${toKst(generatedAt)} KST

## 결론

- Events Manager 확인은 Meta 계정 로그인, Pixel/Dataset 접근, 2FA가 필요한 외부 화면 작업이다. Codex가 로컬에서 직접 볼 수 있는 영역은 아니다.
- Codex가 바로 할 수 있는 일은 우리 서버가 Meta로 보낸 CAPI 전송 로그와 자체 attribution ledger를 조인해서, Events Manager에서 확인할 주문 샘플을 좁히는 것이다.
- 이 리포트는 그 로컬 분석 결과다. 반복 전송은 **우리 솔루션 -> Meta CAPI** 방향의 전송 로그를 뜻한다. Meta가 우리에게 다시 보낸 로그가 아니다.

## 분석 범위

- 로그 scope: operational only
- 응답 상태: 2xx success only
- 기본 기간: 최근 ${options.days}일
- since override: ${options.since || "-"}
- until override: ${options.until || "-"}

## 요약

| 지표 | 값 |
|---|---:|
| CAPI success rows | ${summary.success} |
| CAPI failure rows | ${summary.failure} |
| unique event_id | ${summary.uniqueEventIds} |
| duplicate event_id groups | ${summary.duplicateEventIdGroups} |
| duplicate event_id rows | ${summary.duplicateEventIds} |
| unique order+event keys | ${summary.uniqueOrderEventKeys} |
| duplicate order+event groups | ${summary.duplicateOrderEventGroups} |
| retry-like groups, same event_id | ${summary.duplicateOrderEventBreakdown.retryLikeGroups} |
| retry-like rows, same event_id | ${summary.duplicateOrderEventBreakdown.retryLikeRows} |
| multi-event-id risk groups | ${summary.duplicateOrderEventBreakdown.multiEventIdGroups} |
| multi-event-id risk rows | ${summary.duplicateOrderEventBreakdown.multiEventIdRows} |

## 위험 후보: 같은 주문+이벤트인데 event_id가 다른 그룹
${renderCandidateTable(multiEventIdDetails, 20)}

${highRisk ? `### 최우선 Events Manager 확인 주문

- orderId: ${highRisk.orderId}
- eventName: ${highRisk.eventName}
- row count: ${highRisk.count}
- unique event_id: ${highRisk.uniqueEventIds}
- 확인 이유: 같은 주문+Purchase가 서로 다른 event_id로 전송되어 Meta dedup이 실패했을 가능성이 가장 높다.

${renderDetailRows(highRisk)}

해석:

- 이 주문은 같은 승인 시각을 가진 주문인데, event_id suffix가 두 개로 갈라졌다.
- suffix 중 하나는 결제 승인시각에 가깝고, 다른 하나는 ledger loggedAt에 가깝다.
- 따라서 이미 반영한 event_id 생성식 수정 전 로그일 가능성이 높다.
` : ""}

## retry-like 후보: 같은 주문+이벤트+event_id 반복 그룹
${renderCandidateTable(retryLikeDetails, 20)}

해석:

- 같은 event_id가 2-3회 반복 전송된 그룹이다.
- 단순 재시도 또는 과거 auto_sync 반복 실행일 수 있다.
- event_id가 같아도 같은 채널 CAPI-CAPI 중복을 Meta가 항상 안전하게 줄인다고 단정하면 안 된다.
- 그래도 multi-event-id 그룹보다 위험도는 낮다. 먼저 Events Manager에서는 multi-event-id 주문을 본 뒤, retry-like 상위 주문을 샘플 확인한다.

## TJ님이 Events Manager에서 확인할 것

Meta 광고관리자 캠페인 표가 아니라 **Meta Events Manager**에서 확인해야 한다.

1. Meta Business / Events Manager로 이동한다.
2. Pixel 또는 Dataset에서 pixel_id \`${Object.keys(summary.countsByPixelId)[0] ?? ""}\`를 찾는다.
3. 최근 이벤트 또는 Purchase 이벤트 상세에서 위 orderId/event_id를 검색한다. 검색이 안 되면 해당 sent KST 시각 전후 5분의 Purchase 이벤트를 연다.
4. 주문 1건에 Purchase가 몇 개 잡혔는지 확인한다.
5. Browser Pixel과 Server CAPI가 둘 다 있다면 event_id가 같은지 확인한다.
6. CAPI-CAPI 또는 Pixel-Pixel처럼 같은 채널 안에서 Purchase가 여러 번 잡혔는지 확인한다.
7. 확인 결과를 스크린샷으로 남긴다. 특히 event_id, event_name, action_source, event_time, dedup 상태가 보이면 좋다.

## 다음 개발 액션

- post-fix 구간에서 multi-event-id risk가 0인지 매일 snapshot으로 남긴다.
- retry-like 그룹이 계속 생기면 auto_sync 실행 이력과 lock/guard를 추가 점검한다.
- Events Manager 확인 결과 multi-event-id 주문이 실제 Meta purchase 중복으로 잡히면, orderId/paymentKey+eventName 기준 성공 전송 차단 규칙을 더 강하게 적용한다.
`;
};

const main = async () => {
  const options = parseArgs();
  const generatedAt = new Date().toISOString();
  const logs = filterOperationalSuccessLogs(await readMetaCapiSendLogs(), options);
  const summary = buildMetaCapiLogDiagnostics(logs);
  const multiEventIdDetails = await buildMetaCapiDedupCandidateDetails(logs, {
    classification: "multiple_event_ids_duplicate_risk",
    limit: options.limit,
  });
  const retryLikeDetails = await buildMetaCapiDedupCandidateDetails(logs, {
    classification: "same_event_id_retry_like",
    limit: options.limit,
  });

  const report = {
    ok: true,
    generatedAt,
    filters: {
      scope: "operational",
      response_status_class: "success",
      days: options.days,
      since: options.since || null,
      until: options.until || null,
    },
    summary,
    multiEventIdDetails,
    retryLikeDetails,
  };

  await mkdir(path.dirname(options.outPrefix), { recursive: true });
  const jsonPath = `${options.outPrefix}.json`;
  const markdownPath = `${options.outPrefix}.md`;
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, renderMarkdown({
    generatedAt,
    options,
    summary,
    multiEventIdDetails,
    retryLikeDetails,
  }), "utf8");

  console.log(JSON.stringify({
    ok: true,
    jsonPath,
    markdownPath,
    summary: {
      total: summary.total,
      success: summary.success,
      duplicateOrderEventBreakdown: summary.duplicateOrderEventBreakdown,
    },
  }, null, 2));
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
