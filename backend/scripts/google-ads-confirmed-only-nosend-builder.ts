#!/usr/bin/env tsx
import fs from "node:fs";
import path from "node:path";

type DatePreset = "last_7d" | "last_30d";

type DashboardResponse = {
  ok?: boolean;
  fetchedAt?: string;
  datePreset?: DatePreset;
  clickIdHealth?: {
    windowDays?: number;
    dateRange?: {
      startDate?: string;
      endDate?: string;
      startAt?: string;
      endAt?: string;
      timezone?: string;
    };
    generatedAt?: string;
    source?: string;
    mode?: string;
    orderCount?: number;
    totalValueKrw?: number;
    withGoogleClickId?: number;
    missingGoogleClickId?: number;
    preservationRate?: number;
    uploadCandidateCount?: number;
    sendCandidateCount?: number;
    clickIdBreakdown?: {
      gclid?: number;
      gbraid?: number;
      wbraid?: number;
    };
    paymentMethodBreakdown?: Array<{
      paymentMethod: string;
      orders: number;
      withGoogleClickId: number;
      missingGoogleClickId: number;
      preservationRate: number;
    }>;
    blockReasonCounts?: Record<string, number>;
    sourceFreshness?: {
      source?: string;
      maxOrderDateKst?: string;
      maxPaymentCompleteKst?: string;
      syncLagMinutes?: number;
      status?: string;
      warnings?: string[];
    };
    caveats?: string[];
  };
  conversionActionSegments?: {
    summary?: Record<string, number>;
  };
};

type NoSendWindow = {
  key: string;
  label: string;
  source: string;
  window: unknown;
  fetchedAt: string | null;
  actualConfirmedOrders: number;
  actualConfirmedRevenueKrw: number | null;
  directGoogleClickEvidenceOrders: number;
  missingGoogleClickIdOrders: number;
  preservationRate: number;
  rawOrderPayloadAvailable: boolean;
  noSendCandidateCount: 0;
  sendCandidateCount: 0;
  uploadCandidateCount: 0;
  directEvidenceNeedsOrderPayloadReview: number;
  blockReasonCounts: Record<string, number>;
  clickIdBreakdown: {
    gclid: number;
    gbraid: number;
    wbraid: number;
  };
  paymentMethodBreakdown: Array<{
    paymentMethod: string;
    orders: number;
    directGoogleClickEvidenceOrders: number;
    missingGoogleClickIdOrders: number;
    preservationRate: number;
  }>;
  freshness: unknown;
};

const REPO_ROOT = path.resolve(__dirname, "..", "..");

const argValue = (name: string) => {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
};

const todayKst = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()).replaceAll("-", "");

const nowKst = () =>
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

const numberFrom = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const pct = (value: number) => `${(value * 100).toFixed(2)}%`;

const mdEscape = (value: unknown) => String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");

const mdTable = (headers: string[], rows: unknown[][]) => [
  `| ${headers.map(mdEscape).join(" | ")} |`,
  `| ${headers.map(() => "---").join(" | ")} |`,
  ...rows.map((row) => `| ${row.map(mdEscape).join(" | ")} |`),
].join("\n");

const toYaml = (value: unknown, indent = 0): string => {
  const pad = " ".repeat(indent);
  if (Array.isArray(value)) {
    if (value.length === 0) return `${pad}[]`;
    return value.map((item) => {
      if (item && typeof item === "object") {
        return `${pad}-\n${toYaml(item, indent + 2)}`;
      }
      return `${pad}- ${JSON.stringify(item)}`;
    }).join("\n");
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return `${pad}{}`;
    return entries.map(([key, item]) => {
      if (item && typeof item === "object") {
        return `${pad}${key}:\n${toYaml(item, indent + 2)}`;
      }
      return `${pad}${key}: ${JSON.stringify(item)}`;
    }).join("\n");
  }
  return `${pad}${JSON.stringify(value)}`;
};

const outputDate = argValue("date") ?? todayKst();
const apiBase = (argValue("api-base") ?? "https://att.ainativeos.net").replace(/\/$/, "");
const jsonOutput = path.resolve(
  argValue("json-output") ??
    path.join(REPO_ROOT, "data", "project", `google-ads-confirmed-only-nosend-builder-${outputDate}.json`),
);
const markdownOutput = path.resolve(
  argValue("markdown-output") ??
    path.join(REPO_ROOT, "project", `google-ads-confirmed-only-nosend-builder-${outputDate}.md`),
);

const dashboardUrl = (preset: DatePreset) =>
  `${apiBase}/api/google-ads/dashboard?date_preset=${encodeURIComponent(preset)}`;

const fetchJson = async (url: string): Promise<DashboardResponse> => {
  const fetchFn = (globalThis as unknown as { fetch?: typeof fetch }).fetch;
  if (!fetchFn) throw new Error("global fetch is not available");
  const response = await fetchFn(url);
  if (!response.ok) throw new Error(`fetch failed ${response.status}: ${url}`);
  return (await response.json()) as DashboardResponse;
};

const buildWindowFromDashboard = (
  preset: DatePreset,
  body: DashboardResponse,
): NoSendWindow => {
  const health = body.clickIdHealth ?? {};
  const orderCount = numberFrom(health.orderCount);
  const withClick = numberFrom(health.withGoogleClickId);
  const missingClick = numberFrom(health.missingGoogleClickId);
  const missingAttribution = numberFrom(health.blockReasonCounts?.missingAttributionVmEvidence);

  return {
    key: preset,
    label: preset === "last_7d" ? "최근 7일" : "최근 30일",
    source: "VM Cloud public dashboard API aggregate",
    window: health.dateRange ?? { preset },
    fetchedAt: body.fetchedAt ?? health.generatedAt ?? null,
    actualConfirmedOrders: orderCount,
    actualConfirmedRevenueKrw: health.totalValueKrw ?? null,
    directGoogleClickEvidenceOrders: withClick,
    missingGoogleClickIdOrders: missingClick,
    preservationRate: numberFrom(health.preservationRate),
    rawOrderPayloadAvailable: false,
    noSendCandidateCount: 0,
    sendCandidateCount: 0,
    uploadCandidateCount: 0,
    directEvidenceNeedsOrderPayloadReview: withClick,
    blockReasonCounts: {
      read_only_phase: orderCount,
      approval_required: orderCount,
      google_ads_conversion_action_not_created_or_selected: orderCount,
      conversion_upload_not_approved: orderCount,
      exact_order_level_payload_not_exported_from_public_endpoint: withClick,
      missing_google_click_id: missingClick,
      missing_attribution_vm_evidence: missingAttribution,
    },
    clickIdBreakdown: {
      gclid: numberFrom(health.clickIdBreakdown?.gclid),
      gbraid: numberFrom(health.clickIdBreakdown?.gbraid),
      wbraid: numberFrom(health.clickIdBreakdown?.wbraid),
    },
    paymentMethodBreakdown: (health.paymentMethodBreakdown ?? []).map((row) => ({
      paymentMethod: row.paymentMethod,
      orders: row.orders,
      directGoogleClickEvidenceOrders: row.withGoogleClickId,
      missingGoogleClickIdOrders: row.missingGoogleClickId,
      preservationRate: row.preservationRate,
    })),
    freshness: health.sourceFreshness ?? null,
  };
};

const postPatchSnapshot: NoSendWindow = {
  key: "post_patch_20260521_2115",
  label: "5월 21일 21:15 보강 이후",
  source: "frontend report snapshot from VM Cloud SQLite + operational DB read-only",
  window: {
    patchStartedAtKst: "2026-05-21 21:15 KST",
    checkedAtKst: "2026-05-24 KST",
  },
  fetchedAt: null,
  actualConfirmedOrders: 114,
  actualConfirmedRevenueKrw: null,
  directGoogleClickEvidenceOrders: 0,
  missingGoogleClickIdOrders: 114,
  preservationRate: 0,
  rawOrderPayloadAvailable: false,
  noSendCandidateCount: 0,
  sendCandidateCount: 0,
  uploadCandidateCount: 0,
  directEvidenceNeedsOrderPayloadReview: 0,
  blockReasonCounts: {
    read_only_phase: 114,
    approval_required: 114,
    google_ads_conversion_action_not_created_or_selected: 114,
    conversion_upload_not_approved: 114,
    missing_google_click_id: 114,
  },
  clickIdBreakdown: {
    gclid: 0,
    gbraid: 0,
    wbraid: 0,
  },
  paymentMethodBreakdown: [
    {
      paymentMethod: "homepage",
      orders: 112,
      directGoogleClickEvidenceOrders: 0,
      missingGoogleClickIdOrders: 112,
      preservationRate: 0,
    },
    {
      paymentMethod: "npay",
      orders: 2,
      directGoogleClickEvidenceOrders: 0,
      missingGoogleClickIdOrders: 2,
      preservationRate: 0,
    },
  ],
  freshness: {
    note: "snapshot is from report constants. Use VM order-level read-only endpoint before any send decision.",
  },
};

const clickStageSnapshot = {
  source: "VM Cloud SQLite read-only snapshot embedded in frontend report",
  checkedAtKst: "2026-05-24 KST",
  patchStartedAtKst: "2026-05-21 21:15 KST",
  siteLanding: {
    label: "고객 유입 장부",
    googleClickIdRows: 2865,
    gadCampaignIdRows: 2759,
    campaignIdCoverageRate: 0.963,
    meaning: "광고 클릭 직후 URL 파라미터가 사이트 첫 진입 장부에 남는지 보는 단계",
  },
  paidClickIntent: {
    label: "유료 클릭 의도 장부",
    googleClickIdRows: 2935,
    gadCampaignIdRows: 2909,
    campaignIdCoverageRate: 0.9911,
    meaning: "GTM/아임웹 태그가 클릭 직후 허용 파라미터를 저장했는지 보는 단계",
  },
  confirmedPaymentSuccess: {
    label: "실제 결제완료 장부",
    confirmedPaymentSuccessRows: 114,
    directGoogleClickEvidenceRows: 0,
    preservationRate: 0,
    meaning: "실제 결제완료 주문에 gclid/gbraid/wbraid가 직접 남는지 보는 단계",
  },
};

const buildPayload = async () => {
  const [last7, last30] = await Promise.all([
    fetchJson(dashboardUrl("last_7d")),
    fetchJson(dashboardUrl("last_30d")),
  ]);

  const windows = [
    buildWindowFromDashboard("last_7d", last7),
    buildWindowFromDashboard("last_30d", last30),
    postPatchSnapshot,
  ];

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    generatedAtKst: nowKst(),
    mode: "confirmed_purchase_no_send_candidate_builder",
    harness_preflight: {
      common_harness_read: [
        "harness/common/HARNESS_GUIDELINES.md",
        "harness/common/AUTONOMY_POLICY.md",
        "harness/common/REPORTING_TEMPLATE.md",
      ],
      project_harness_read: [
        "AGENTS.md",
        "data/!data_inventory.md",
        "gdn/attribution-data-source-decision-guide-20260511.md",
      ],
      lane: "Green",
      allowed_actions: [
        "public_api_read_only",
        "local_script_write",
        "local_json_report_write",
        "local_markdown_report_write",
      ],
      forbidden_actions: [
        "google_ads_conversion_upload",
        "google_ads_conversion_action_change",
        "google_ads_primary_goal_change",
        "operational_db_write",
        "vm_cloud_sqlite_write",
        "deploy_or_restart",
        "gtm_publish",
      ],
      source_window_freshness_confidence: {
        source: "VM Cloud public dashboard aggregate + frontend post-patch report snapshot",
        window: "last_7d, last_30d, post_patch_20260521_2115",
        freshness: "last_7d/last_30d from live public API; post_patch snapshot from current frontend report constants",
        confidence: "medium-high for aggregate counts, medium for exact loss point until order-level endpoint is added",
      },
    },
    guardrails: {
      noSend: true,
      noWrite: true,
      noDeploy: true,
      noPublish: true,
      noPlatformSend: true,
      rawOrderIdOutput: false,
      rawClickIdOutput: false,
    },
    whyGoogleAdsWouldReceiveThisLater: {
      plainKorean:
        "Google Ads가 자동입찰을 할 때 '어떤 클릭이 실제 매출을 만들었는지'를 배웁니다. 지금 Google Ads의 구매완료 숫자는 NPay 클릭/결제시작 같은 넓은 신호가 섞였을 가능성이 커서, 나중에는 내부 장부에서 실제 결제완료로 확인된 주문만 별도 전환으로 알려주는 것이 목적입니다.",
      currentDecision:
        "지금은 보내지 않습니다. 실제 결제완료 주문에 Google click id와 주문 payload가 안전하게 붙는 후보가 부족하고, conversion action/업로드 승인도 열지 않았습니다.",
    },
    noSendWindows: windows,
    lastLossPoint: {
      conclusion:
        "마지막으로 크게 끊기는 지점은 광고 클릭 직후가 아니라, 결제완료 주문으로 넘어가는 payment_success/order bridge 구간입니다.",
      evidence: [
        {
          step: "광고 클릭 직후",
          observed:
            "5월 21일 21:15 KST 보강 이후 고객 유입 장부는 Google click id 2,865건, 그중 gad_campaignid 2,759건입니다.",
          interpretation:
            "클릭 URL 파라미터 자체는 대부분 들어오고 있습니다.",
        },
        {
          step: "태그가 저장한 유료 클릭 의도",
          observed:
            "같은 기간 유료 클릭 의도 장부는 Google click id 2,935건, 그중 gad_campaignid 2,909건입니다.",
          interpretation:
            "GTM/아임웹 태그의 초기 수집도 대체로 정상입니다.",
        },
        {
          step: "실제 결제완료",
          observed:
            "같은 기간 confirmed payment_success 114건 중 직접 Google click id 보존은 0건입니다. live 최근 7일 전체로 넓히면 466건 중 5건만 직접 보존입니다.",
          interpretation:
            "결제완료 주문에 붙는 최종 evidence가 부족합니다. Google Ads upload 후보로 올릴 수 없습니다.",
        },
      ],
      nextProofNeeded:
        "정확한 마지막 코드 경로를 닫으려면 order-level read-only 진단이 필요합니다. 공개 API는 aggregate만 주므로 raw 주문번호/click id를 노출하지 않는 safe_ref 단위 order-level diagnostic endpoint 또는 VM Cloud SQLite read-only 접근이 다음 단계입니다.",
    },
    decision: {
      sendCandidateCount: 0,
      uploadCandidateCount: 0,
      reason:
        "실제 결제완료 주문 기준으로도 read-only/approval guard가 켜져 있고, 다수 주문은 Google click id가 직접 보존되지 않습니다. direct evidence가 있는 aggregate 주문도 공개 API에는 order-level payload가 없어 전송 후보가 아닙니다.",
    },
  };
};

const renderMarkdown = (payload: Awaited<ReturnType<typeof buildPayload>>) => {
  const windows = payload.noSendWindows;

  return [
    "# Google Ads 실제 결제완료 no-send 후보 생성 결과",
    "",
    `작성 시각: ${payload.generatedAtKst}`,
    "문서 성격: read-only / no-send / no-write",
    "",
    "```yaml",
    "harness_preflight:",
    toYaml(payload.harness_preflight, 2),
    "```",
    "",
    "## 한 줄 결론",
    "",
    "실제 결제완료 주문만 Google Ads에 보낼 수 있는지 다시 계산했지만, 지금 전송 후보는 0건입니다. 광고 클릭은 초반 장부에 잘 들어오지만, 결제완료 주문으로 넘어갈 때 Google click id가 거의 사라집니다.",
    "",
    "## Google Ads에는 왜 보내는가",
    "",
    payload.whyGoogleAdsWouldReceiveThisLater.plainKorean,
    "",
    `현재 판단: ${payload.whyGoogleAdsWouldReceiveThisLater.currentDecision}`,
    "",
    "## no-send 후보 판정",
    "",
    mdTable(
      [
        "기준",
        "실제 결제완료",
        "매출",
        "click id 직접 보존",
        "보존률",
        "전송 후보",
        "주요 차단 이유",
      ],
      windows.map((row) => [
        row.label,
        row.actualConfirmedOrders.toLocaleString("ko-KR"),
        row.actualConfirmedRevenueKrw === null ? "n/a" : row.actualConfirmedRevenueKrw.toLocaleString("ko-KR"),
        row.directGoogleClickEvidenceOrders.toLocaleString("ko-KR"),
        pct(row.preservationRate),
        row.sendCandidateCount,
        Object.entries(row.blockReasonCounts)
          .filter(([, count]) => count > 0)
          .slice(0, 4)
          .map(([key, count]) => `${key} ${count}`)
          .join(", "),
      ]),
    ),
    "",
    "## click id가 마지막으로 끊기는 지점",
    "",
    `결론: ${payload.lastLossPoint.conclusion}`,
    "",
    mdTable(
      ["단계", "관측값", "뜻"],
      payload.lastLossPoint.evidence.map((row) => [row.step, row.observed, row.interpretation]),
    ),
    "",
    "## 왜 아직 Google Ads upload 후보가 아닌가",
    "",
    "- `send_candidate=0`: 이 스크립트는 실제 Google Ads 전송 코드를 호출하지 않습니다.",
    "- `read_only_phase`: 지금은 후보 판정만 합니다.",
    "- `approval_required`: 실제 전송은 TJ님이 별도 승인해야 합니다.",
    "- `missing_google_click_id`: 대부분의 실제 결제완료 주문에 gclid/gbraid/wbraid가 직접 남지 않았습니다.",
    "- `exact_order_level_payload_not_exported_from_public_endpoint`: 공개 API는 aggregate라서 실제 전송 payload를 만들 주문 단위 데이터가 없습니다.",
    "",
    "## 다음 증거",
    "",
    payload.lastLossPoint.nextProofNeeded,
    "",
    "## Guardrails",
    "",
    "```text",
    "Google Ads conversion upload: NOT RUN",
    "Google Ads conversion action change: NOT RUN",
    "운영DB write: NOT RUN",
    "VM Cloud SQLite write: NOT RUN",
    "배포/restart: NOT RUN",
    "raw order id 출력: 0",
    "raw click id 출력: 0",
    "```",
  ].join("\n");
};

buildPayload()
  .then((payload) => {
    fs.mkdirSync(path.dirname(jsonOutput), { recursive: true });
    fs.mkdirSync(path.dirname(markdownOutput), { recursive: true });
    fs.writeFileSync(jsonOutput, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    fs.writeFileSync(markdownOutput, `${renderMarkdown(payload)}\n`, "utf8");
    process.stdout.write(JSON.stringify({
      ok: true,
      jsonOutput,
      markdownOutput,
      sendCandidateCount: payload.decision.sendCandidateCount,
      uploadCandidateCount: payload.decision.uploadCandidateCount,
      generatedAtKst: payload.generatedAtKst,
    }, null, 2));
    process.stdout.write("\n");
  })
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exit(1);
  });
