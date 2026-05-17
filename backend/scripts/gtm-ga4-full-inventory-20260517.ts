#!/usr/bin/env tsx
/**
 * Green read-only GTM + GA4 inventory generator.
 *
 * Outputs aggregate documentation only:
 * - no GTM publish / submit / version creation
 * - no GA4 Measurement Protocol send
 * - no platform send/upload
 * - no 운영DB write
 */

import fs from "node:fs/promises";
import path from "node:path";

import dotenv from "dotenv";
import { google } from "googleapis";

dotenv.config({ path: path.resolve(__dirname, "..", ".env"), quiet: true });

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const OUTPUT_DATE = "20260517";
const JOB_PROJECT_ID = process.env.BIGQUERY_JOB_PROJECT_ID?.trim() || "project-dadba7dd-0229-4ff6-81c";
const BQ_LOCATION = process.env.GA4_BQ_LOCATION?.trim() || "asia-northeast3";
const SERVICE_ACCOUNT =
  process.env.GSC_SERVICE_ACCOUNT_KEY ||
  process.env.GA4_BIOCOM_SERVICE_ACCOUNT_KEY ||
  process.env.GA4_SERVICE_ACCOUNT_KEY ||
  "";

type SiteKey = "biocom" | "thecleancoffee";

type SiteConfig = {
  key: SiteKey;
  displayName: string;
  domain: string;
  gtmPublicId: string;
  canonicalMeasurementId: string;
  ga4Project: string;
  ga4Dataset: string;
  ga4PropertyId: string;
};

const SITES: SiteConfig[] = [
  {
    key: "biocom",
    displayName: "바이오컴",
    domain: "biocom.kr",
    gtmPublicId: "GTM-W2Z6PHN",
    canonicalMeasurementId: "G-WJFXN5E2Q1",
    ga4Project: "project-dadba7dd-0229-4ff6-81c",
    ga4Dataset: "analytics_304759974",
    ga4PropertyId: "304759974",
  },
  {
    key: "thecleancoffee",
    displayName: "더클린커피",
    domain: "thecleancoffee.com",
    gtmPublicId: "GTM-5M33GC4",
    canonicalMeasurementId: "G-JLSBXX7300",
    ga4Project: "project-dadba7dd-0229-4ff6-81c",
    ga4Dataset: "analytics_326949178",
    ga4PropertyId: "326949178",
  },
];

type RawParameter = {
  key?: string;
  value?: string;
  list?: Array<{ map?: RawParameter[] }>;
  map?: RawParameter[];
};

type RawTag = {
  tagId?: string;
  name?: string;
  type?: string;
  paused?: boolean;
  parameter?: RawParameter[];
  firingTriggerId?: string[];
  blockingTriggerId?: string[];
};

type RawTrigger = {
  triggerId?: string;
  name?: string;
  type?: string;
};

type EventSummary = {
  event_name: string;
  events: number;
  sessions: number;
  users: number;
  cart_page_events: number;
  checkout_or_payment_page_events: number;
  product_page_events: number;
  latest_event_at_kst: string;
};

type TagSummary = {
  tag_id: string;
  status: "active" | "paused";
  type: string;
  name: string;
  destination_or_event: string;
  measurement_or_platform_id: string;
  firing_triggers: string;
  blocking_triggers: string;
  note: string;
};

type SiteInventory = {
  site: SiteConfig;
  gtm: {
    account: string;
    containerName: string;
    containerId: string;
    publicId: string;
    liveVersionId: string;
    liveVersionName: string;
    tagCount: number;
    triggerCount: number;
    variableCount: number;
    tags: TagSummary[];
  };
  ga4: {
    source: string;
    latestDailyTable: string;
    startDate: string;
    endDate: string;
    dailyTableCount: number;
    events: EventSummary[];
  };
};

const nowKst = () =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(new Date())
    .replace("T", " ");

const parseJson = <T>(raw: string, fallback: T): T => {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const credentials = () => {
  if (!SERVICE_ACCOUNT.trim()) throw new Error("missing_service_account_env");
  const parsed = parseJson<Record<string, string>>(SERVICE_ACCOUNT, {});
  if (!parsed.client_email || !parsed.private_key) throw new Error("invalid_service_account_env");
  return parsed;
};

const googleAuth = (scopes: string[]) => {
  const c = credentials();
  return new google.auth.JWT({
    email: c.client_email,
    key: c.private_key,
    scopes,
  });
};

const createTagManager = () =>
  google.tagmanager({
    version: "v2",
    auth: googleAuth(["https://www.googleapis.com/auth/tagmanager.readonly"]),
  });

const createBigQuery = () =>
  google.bigquery({
    version: "v2",
    auth: googleAuth(["https://www.googleapis.com/auth/bigquery", "https://www.googleapis.com/auth/cloud-platform"]),
  });

const paramValue = (parameters: RawParameter[] | undefined, key: string): string => {
  const found = (parameters || []).find((p) => p.key === key);
  return found?.value || "";
};

const eventSettings = (parameters: RawParameter[] | undefined): Record<string, string> => {
  const settings = (parameters || []).find((p) => p.key === "eventSettingsTable");
  const output: Record<string, string> = {};
  for (const item of settings?.list || []) {
    const rows = item.map || [];
    const name = rows.find((row) => row.key === "parameter")?.value || "";
    const value = rows.find((row) => row.key === "parameterValue")?.value || "";
    if (name) output[name] = value;
  }
  return output;
};

const classifyTag = (tag: RawTag): { destination: string; measurement: string; note: string } => {
  const params = tag.parameter || [];
  const type = tag.type || "";
  const settings = eventSettings(params);

  if (type === "gaawe") {
    const eventName = paramValue(params, "eventName") || "(eventName 없음)";
    const measurement = paramValue(params, "measurementIdOverride") || paramValue(params, "measurementId") || "(측정 ID 없음)";
    const importantParams = ["transaction_id", "value", "currency", "items", "pay_method", "shipping", "method"]
      .filter((key) => settings[key])
      .map((key) => `${key}=Y`);
    return {
      destination: `GA4 event: ${eventName}`,
      measurement,
      note: importantParams.length ? importantParams.join(", ") : "GA4 event 전송",
    };
  }

  if (type === "googtag") {
    const tagId = paramValue(params, "tagId") || paramValue(params, "measurementIdOverride") || paramValue(params, "measurementId");
    return {
      destination: "Google tag config",
      measurement: tagId || "(ID 확인 필요)",
      note: "기본 Google/GA4/Ads 태그",
    };
  }

  if (type === "awct") {
    const conversionId = paramValue(params, "conversionId") || paramValue(params, "tagId");
    const conversionLabel = paramValue(params, "conversionLabel");
    return {
      destination: "Google Ads conversion",
      measurement: conversionId ? `AW-${conversionId}` : "(conversionId 확인 필요)",
      note: conversionLabel ? "conversion label 있음" : "conversion label 없음/확인 필요",
    };
  }

  if (type === "gclidw") {
    return { destination: "Conversion Linker", measurement: "Google Ads click id 보존", note: "클릭 ID 보존용" };
  }

  if (type === "sp") {
    const conversionId = paramValue(params, "conversionId") || paramValue(params, "tagId");
    return { destination: "Google Ads remarketing", measurement: conversionId ? `AW-${conversionId}` : "(ID 확인 필요)", note: "리마케팅" };
  }

  if (type === "ua") {
    return { destination: "Universal Analytics legacy event", measurement: "UA", note: "GA4 정본 아님" };
  }

  if (type === "html") {
    const lowerName = (tag.name || "").toLowerCase();
    const hint = lowerName.includes("네이버페이") || lowerName.includes("npay")
      ? "NPay intent/dataLayer 후보. 실제 결제완료 아님"
      : lowerName.includes("데이터레이어")
        ? "dataLayer push 후보"
        : "Custom HTML";
    return { destination: "Custom HTML", measurement: "브라우저 실행 스크립트", note: hint };
  }

  return { destination: type || "(type 없음)", measurement: "-", note: "custom/template/기타 태그" };
};

const markdownTable = (headers: string[], rows: Array<Array<string | number>>) => {
  const escape = (value: string | number) =>
    String(value)
      .replace(/\|/g, "\\|")
      .replace(/\n/g, "<br>");
  return [
    `| ${headers.map(escape).join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map(escape).join(" | ")} |`),
  ].join("\n");
};

const listDailySuffixes = async (
  bq: ReturnType<typeof createBigQuery>,
  projectId: string,
  datasetId: string,
) => {
  const suffixes: string[] = [];
  let pageToken: string | undefined;
  do {
    const result = await bq.tables.list({
      projectId,
      datasetId,
      pageToken,
      maxResults: 1000,
    });
    for (const table of result.data.tables || []) {
      const tableId = table.tableReference?.tableId || "";
      const matched = /^events_(\d{8})$/.exec(tableId);
      if (matched) suffixes.push(matched[1]);
    }
    pageToken = result.data.nextPageToken || undefined;
  } while (pageToken);
  return suffixes.sort();
};

const suffixToIsoDate = (suffix: string) => `${suffix.slice(0, 4)}-${suffix.slice(4, 6)}-${suffix.slice(6, 8)}`;

const availableExportWindow = async (
  bq: ReturnType<typeof createBigQuery>,
  site: SiteConfig,
) => {
  const suffixes = await listDailySuffixes(bq, site.ga4Project, site.ga4Dataset);
  const firstSuffix = suffixes.at(0);
  const latestSuffix = suffixes.at(-1);
  if (!firstSuffix || !latestSuffix) throw new Error(`no_daily_ga4_tables:${site.key}`);
  return {
    startSuffix: firstSuffix,
    endSuffix: latestSuffix,
    latestDailyTable: `events_${latestSuffix}`,
    startDate: suffixToIsoDate(firstSuffix),
    endDate: suffixToIsoDate(latestSuffix),
    dailyTableCount: suffixes.length,
  };
};

const runQuery = async (
  bq: ReturnType<typeof createBigQuery>,
  query: string,
): Promise<Record<string, string | null>[]> => {
  const inserted = await bq.jobs.insert({
    projectId: JOB_PROJECT_ID,
    requestBody: {
      jobReference: { projectId: JOB_PROJECT_ID, location: BQ_LOCATION },
      configuration: {
        query: {
          query,
          useLegacySql: false,
          location: BQ_LOCATION,
        },
      },
    },
  });
  const jobId = inserted.data.jobReference?.jobId;
  if (!jobId) throw new Error("missing_bigquery_job_id");
  for (let attempt = 0; attempt < 90; attempt += 1) {
    const result = await bq.jobs.getQueryResults({
      projectId: JOB_PROJECT_ID,
      jobId,
      location: BQ_LOCATION,
      maxResults: 10000,
    });
    if (result.data.jobComplete) {
      const fields = result.data.schema?.fields?.map((field) => field.name || "") || [];
      return (result.data.rows || []).map((row) => {
        const output: Record<string, string | null> = {};
        (row.f || []).forEach((cell, index) => {
          output[fields[index] || `field_${index}`] = (cell.v as string | null) ?? null;
        });
        return output;
      });
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("bigquery_query_timeout");
};

const ga4EventQuery = (site: SiteConfig, startSuffix: string, endSuffix: string) => `
WITH base AS (
  SELECT
    event_name,
    event_timestamp,
    user_pseudo_id,
    CAST((SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_id') AS STRING) AS ga_session_id,
    LOWER(COALESCE((SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_location'), '')) AS page_location
  FROM \`${site.ga4Project}.${site.ga4Dataset}.events_*\`
  WHERE _TABLE_SUFFIX BETWEEN '${startSuffix}' AND '${endSuffix}'
)
SELECT
  event_name,
  COUNT(*) AS events,
  COUNT(DISTINCT user_pseudo_id) AS users,
  COUNT(DISTINCT CONCAT(COALESCE(user_pseudo_id, ''), '.', COALESCE(ga_session_id, ''))) AS sessions,
  COUNTIF(REGEXP_CONTAINS(page_location, r'/shop_cart|cart')) AS cart_page_events,
  COUNTIF(REGEXP_CONTAINS(page_location, r'/shop_payment|shop_order|checkout|payment')) AS checkout_or_payment_page_events,
  COUNTIF(REGEXP_CONTAINS(page_location, r'/shop_view|goods|product|diet|coffee')) AS product_page_events,
  FORMAT_TIMESTAMP('%F %H:%M:%S', TIMESTAMP_MICROS(MAX(event_timestamp)), 'Asia/Seoul') AS latest_event_at_kst
FROM base
GROUP BY event_name
ORDER BY events DESC, event_name
`;

const getLiveContainerVersion = async (
  gtm: ReturnType<typeof createTagManager>,
  publicId: string,
) => {
  const accounts = (await gtm.accounts.list({})).data.account || [];
  for (const account of accounts) {
    const containers = (await gtm.accounts.containers.list({ parent: account.path || "" })).data.container || [];
    const container = containers.find((candidate) => candidate.publicId === publicId);
    if (!container) continue;

    const latest = await gtm.accounts.containers.version_headers.latest({ parent: container.path || "" });
    const versionPath = latest.data.path || "";
    const version = await gtm.accounts.containers.versions.get({ path: versionPath });
    return {
      accountName: account.name || "",
      containerName: container.name || "",
      containerId: container.containerId || "",
      publicId: container.publicId || "",
      liveVersionId: latest.data.containerVersionId || "",
      liveVersionName: latest.data.name || "",
      tags: (version.data.tag || []) as RawTag[],
      triggers: (version.data.trigger || []) as RawTrigger[],
      variables: version.data.variable || [],
    };
  }
  throw new Error(`container_not_found:${publicId}`);
};

const summarizeTags = (tags: RawTag[], triggers: RawTrigger[]): TagSummary[] => {
  const triggerName = new Map(triggers.map((trigger) => [trigger.triggerId || "", trigger.name || ""]));
  return tags
    .slice()
    .sort((a, b) => Number(a.tagId || 0) - Number(b.tagId || 0))
    .map((tag) => {
      const classified = classifyTag(tag);
      return {
        tag_id: tag.tagId || "",
        status: tag.paused ? "paused" : "active",
        type: tag.type || "",
        name: tag.name || "",
        destination_or_event: classified.destination,
        measurement_or_platform_id: classified.measurement,
        firing_triggers: (tag.firingTriggerId || []).map((id) => triggerName.get(id) || `trigger ${id}`).join(", ") || "-",
        blocking_triggers: (tag.blockingTriggerId || []).map((id) => triggerName.get(id) || `trigger ${id}`).join(", ") || "-",
        note: classified.note,
      };
    });
};

const generateSiteDoc = (inventory: SiteInventory) => {
  const { site, gtm, ga4 } = inventory;
  const standardRows = ["page_view", "view_item", "add_to_cart", "view_cart", "begin_checkout", "add_payment_info", "purchase", "scroll", "page_view_long"].map(
    (eventName) => {
      const found = ga4.events.find((event) => event.event_name === eventName);
      return [
        eventName,
        found?.events ?? 0,
        found?.sessions ?? 0,
        found?.latest_event_at_kst ?? "-",
        found ? "적재 확인" : "현재 export 기간 미적재",
      ];
    },
  );

  const title = `${site.displayName} GTM/GA4 태그·이벤트 인벤토리`;
  return `# ${title}

작성 시각: ${nowKst()} KST
기준일: 2026-05-17
문서 성격: ${site.displayName} GTM live tag + GA4 BigQuery event inventory

\`\`\`yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  lane: Green
  allowed_actions:
    - gtm_api_read_only
    - ga4_bigquery_read_only_aggregate
    - documentation_update
  forbidden_actions:
    - gtm_submit_create_version_publish
    - ga4_measurement_protocol_send
    - platform_send_or_upload
    - operating_db_write
    - vm_cloud_deploy
source_window_freshness_confidence:
  gtm_source: GTM API live container version
  ga4_source: ${ga4.source}
  window: ${ga4.startDate}~${ga4.endDate}
  freshness: latest daily table ${ga4.latestDailyTable}
  site: ${site.key}
  confidence: high for configured live tags, high for GA4 event existence, medium for runtime trigger cause until Preview
\`\`\`

## 10초 요약

- 이 문서는 ${site.displayName}의 **GTM에 게시된 태그**와 **GA4 BigQuery에 실제 적재된 이벤트**를 한 문서에 분리해 정리한다.
- GTM 태그 이름은 관리용 라벨이고, GA4에 실제로 남는 값은 \`event_name\`이다.
- GA4 이벤트는 현재 BigQuery에 적재된 전체 export 기간(\`${ga4.startDate}~${ga4.endDate}\`)을 read-only로 집계했다.
- 이 문서 작성 과정에서 GTM Publish, GA4/Meta/Google/TikTok/Naver 전송, 운영DB write는 하지 않았다.

## Source / Window / Freshness

${markdownTable(
    ["항목", "값"],
    [
      ["site", `${site.key} (${site.domain})`],
      ["GTM container", `${gtm.publicId} / live version ${gtm.liveVersionId} (${gtm.liveVersionName})`],
      ["GA4 measurement ID", site.canonicalMeasurementId],
      ["GA4 BigQuery source", ga4.source],
      ["GA4 export window", `${ga4.startDate}~${ga4.endDate} (${ga4.dailyTableCount} daily tables)`],
      ["GA4 latest table", ga4.latestDailyTable],
      ["confidence", "GTM live 설정 high / GA4 적재 high / 실제 런타임 원인 medium"],
    ],
  )}

## GTM Live 태그 전체 목록

${markdownTable(
    ["tagId", "상태", "type", "태그 이름", "보내는 곳/이벤트", "측정/플랫폼 ID", "발화 트리거", "차단 트리거", "메모"],
    gtm.tags.map((tag) => [
      tag.tag_id,
      tag.status,
      tag.type,
      tag.name,
      tag.destination_or_event,
      tag.measurement_or_platform_id,
      tag.firing_triggers,
      tag.blocking_triggers,
      tag.note,
    ]),
  )}

## GA4 표준 퍼널 이벤트 빠른 상태

${markdownTable(["event_name", "events", "sessions", "latest_event_at_kst", "판단"], standardRows)}

## GA4 BigQuery event_name 전체 목록

${markdownTable(
    [
      "event_name",
      "events",
      "users",
      "sessions",
      "cart_page_events",
      "checkout_or_payment_page_events",
      "product_page_events",
      "latest_event_at_kst",
    ],
    ga4.events.map((event) => [
      event.event_name,
      event.events,
      event.users,
      event.sessions,
      event.cart_page_events,
      event.checkout_or_payment_page_events,
      event.product_page_events,
      event.latest_event_at_kst,
    ]),
  )}

${site.key === "thecleancoffee" ? coffeePreviewEvidenceNote() : ""}

## Preview 전용 체크리스트

Preview는 “수정”이 아니라 **실제 브라우저에서 어떤 태그가 발화되는지 보는 검사 모드**다. 아래 항목은 Publish 없이 확인한다.

${site.key === "biocom" ? biocomPreviewChecklist() : coffeePreviewChecklist()}

## 해석 원칙

1. GTM 태그가 있어도 GA4 BigQuery에 0이면, 이름 문제가 아니라 실제 화면에서 트리거가 안 탔거나 dataLayer 조건이 안 맞았을 수 있다.
2. GA4 이벤트가 있어도 실제 주문 정본은 아니다. 구매 매출 판단은 VM Cloud/운영DB/Imweb/Toss 등 결제완료 원장과 분리한다.
3. NPay 클릭/장바구니/결제수단 선택은 구매완료가 아니라 선행지표다.
4. Preview 결과가 필요하면 GTM Preview only로 확인하고, Submit/Create version/Publish는 별도 승인 전 금지한다.
`;
};

const biocomPreviewChecklist = () => `### 바이오컴 Preview에서 확인할 흐름

1. 홈/상품 상세 진입
   - 무엇을 본다: \`PageView\`, \`view_item\`, \`page_view_long\` 후보.
   - 성공 기준: Tag Assistant에서 해당 GA4 태그가 Fired로 보이고, Network에는 GA4 collect만 뜬다.
   - 실패 시: Google tag config와 HURDLERS 상세페이지 dataLayer 태그 발화 순서를 확인한다.

2. 장바구니 담기
   - 무엇을 본다: \`add_to_cart\`, \`view_cart\`.
   - 성공 기준: HURDLERS 장바구니 dataLayer 태그와 GA4 이벤트 전송 태그가 같은 이벤트 체인에서 Fired.
   - 실패 시: 클릭 셀렉터 또는 장바구니 페이지 URL 트리거가 실제 DOM과 맞는지 확인한다.

3. 결제 시작/결제수단 선택
   - 무엇을 본다: \`begin_checkout\`, \`add_payment_info\`.
   - 성공 기준: 결제 페이지 진입과 결제수단 선택이 purchase가 아니라 중간 이벤트로만 보인다.
   - 실패 시: NPay 클릭/카드 선택/가상계좌 선택이 서로 다른 이벤트로 분리되는지 확인한다.

4. 구매완료
   - 무엇을 본다: \`purchase\`는 실제 결제완료 검증이 있을 때만 확인한다.
   - 성공 기준: 테스트 없는 운영 구매 강제 발화 0, 중복 purchase 0.
   - 실패 시: Header Guard/Server CAPI 쪽과 분리해 본다.`;

const coffeePreviewEvidenceNote = () => `## 2026-05-17 Preview 관측 메모

출처: TJ님 GTM Preview / Meta Pixel Helper 스크린샷, read-only 해석.

### 관측된 것

- 상품상세 진입 시 \`HURDLERS - [데이터레이어] 상세페이지 조회\`와 \`HURDLERS - [이벤트전송] 상세페이지 조회\`가 Fired로 보인다.
- 같은 화면에서 GA4 \`view_item\`, 기본 \`PageView\`, Google Ads 리마케팅/전환 링커, Microsoft Clarity가 Fired로 보인다.
- 쿠폰받기 클릭 후에도 GTM Summary 기준 쿠폰 전용 태그는 보이지 않는다.
- Meta Pixel Helper에는 \`SubscribedButtonClick\`이 자동 감지 이벤트처럼 보인다. 이는 GTM/GA4 live 태그가 아니라 Meta/FBE 자동 감지로 해석한다.
- 구매하기 클릭 후에도 상품상세 URL(\`/shop_view?idx=...\`) 상태에서는 \`begin_checkout\` Fired가 보이지 않는다.

### read-only 대조 결과

- GTM live tag/trigger 이름과 HTML 코드에서 \`쿠폰\`/\`coupon\` 전용 태그는 확인되지 않았다.
- 더클린커피 GA4 BigQuery export 기간(\`2026-04-07~2026-05-16\`)에서 \`coupon\`, \`쿠폰\`, \`subscribe\`, \`subscribed\`, \`lead\`, \`button\` 계열 event_name 검색 결과는 \`click\`, \`kakaochannel_click\`뿐이다.
- 따라서 쿠폰받기는 현재 명시적인 GA4/VM/Meta 표준 선행지표로 관리되지 않고, Meta 자동 감지 이벤트에만 부분적으로 보일 가능성이 높다.

### 판단

쿠폰받기는 구매 전 의도가 강한 선행지표라 별도 관리 가치가 있다. 다만 purchase나 add_payment_info로 올리면 안 되고, 다음 중 하나로 분리해야 한다.

1. GA4: \`coupon_download\` 또는 \`select_promotion\` 후보.
2. VM Cloud: \`coupon_received\` 또는 \`coupon_click\` 선행지표 후보.
3. Meta: 바로 Purchase가 아니라 \`Lead\` 또는 custom event 후보. 실제 광고 학습에 넣을지는 별도 Red/Yellow 승인 후 결정.

### 결제하기 버튼 gap 해석

현재 더클린커피 GTM의 \`begin_checkout\`은 상품상세의 구매하기 버튼 클릭이 아니라 \`/shop_payment/?order_code=...\` 패턴의 주문서 화면 DOM Ready에서 dataLayer를 만드는 구조다. 상품상세에서 구매하기 버튼만 눌렀는데 주문서 URL로 이동하지 않거나 옵션/팝업 단계에서 멈추면 \`begin_checkout\`이 Fired되지 않는 것이 정상일 수 있다.
`;

const coffeePreviewChecklist = () => `### 더클린커피 Preview에서 확인할 흐름

1. 상품 상세 진입
   - 무엇을 본다: \`view_item\`, \`page_view_long\`.
   - 성공 기준: HURDLERS 상세페이지 조회 태그와 GA4 이벤트 전송 태그가 Fired.
   - 실패 시: HURDLERS 플러그인 초기화 태그와 상세페이지 DOM 조건을 확인한다.

2. 장바구니 담기
   - 무엇을 본다: \`add_to_cart\`.
   - 성공 기준: \`HURDLERS - [데이터레이어] 장바구니 담기\`가 먼저 Fired되고, 이어서 GA4 \`add_to_cart\`가 Fired.
   - 실패 시: 장바구니 클릭 트리거가 실제 버튼과 맞는지 확인한다.

3. 쿠폰받기
   - 무엇을 본다: 쿠폰 전용 GTM/GA4 태그가 현재 있는지.
   - 성공 기준: 현재는 태그 없음으로 기록한다. Meta Pixel Helper의 \`SubscribedButtonClick\`은 자동 감지 참고값으로만 본다.
   - 실패 시: 쿠폰을 선행지표로 쓸지 결정한 뒤 \`coupon_download\` 또는 \`coupon_click\` 후보로 별도 설계한다.

4. 장바구니 페이지 진입
   - 무엇을 본다: \`view_cart\`가 현재 있는지.
   - 성공 기준: 있으면 Fired, 없으면 “태그 없음/설계 필요”로 기록한다.
   - 실패 시: 새 태그를 바로 만들지 말고 기존 HURDLERS 장바구니 태그와 중복 위험을 먼저 문서화한다.

5. 주문서 작성/결제 시작
   - 무엇을 본다: \`begin_checkout\`.
   - 성공 기준: GTM 설정상 존재하는 \`HURDLES - [이벤트전송] 주문서작성\`이 실제 주문서 화면에서 Fired.
   - 실패 시: 현재 BigQuery export 기간 0과 일치하므로 DOM/트리거 조건 문제로 분류한다.

6. 결제수단 선택/NPay 클릭
   - 무엇을 본다: \`add_payment_info\` 또는 NPay intent.
   - 성공 기준: NPay 클릭이 \`purchase\`가 아니라 결제수단/의도 이벤트로 분리된다.
   - 실패 시: 현재 \`ga4_purchase\` dataLayer는 실제 결제완료로 쓰지 않고 재설계 후보로 둔다.

7. 구매완료
   - 무엇을 본다: \`purchase\`는 실제 완료 URL에서만 발화되는지.
   - 성공 기준: 장바구니/NPay 클릭/주문서 진입에서는 purchase가 Fired되지 않는다.
   - 실패 시: 즉시 publish 금지, 원인만 기록한다.`;

const generateIndexDoc = (inventories: SiteInventory[]) => `# GTM / GA4 인벤토리 인덱스

작성 시각: ${nowKst()} KST
기준일: 2026-05-17
문서 성격: 바이오컴·더클린커피 GTM/GA4 문서 라우터

\`\`\`yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  lane: Green
  allowed_actions:
    - gtm_api_read_only
    - ga4_bigquery_read_only_aggregate
    - documentation_update
  forbidden_actions:
    - gtm_publish
    - gtm_submit_create_version
    - ga4_measurement_protocol_send
    - platform_send_or_upload
    - operating_db_write
    - vm_cloud_deploy
source_window_freshness_confidence:
  source: GTM API live version + GA4 BigQuery daily export
  window: all available GA4 daily export tables per site
  freshness: ${inventories.map((i) => `${i.site.key}:${i.ga4.latestDailyTable}`).join(", ")}
  confidence: high for inventory, medium for runtime firing until Preview
\`\`\`

## 10초 요약

- 기존 \`GA4/gtm.md\`는 바이오컴 중심으로 너무 길어졌고, 더클린커피 메모까지 섞여 있었다.
- 이제 문서는 **인덱스**, **바이오컴 정본**, **더클린커피 정본**, **Preview 전용 체크리스트**로 나눈다.
- 실제 태그 수정, GTM Publish, GA4/Meta/Google/TikTok/Naver 전송은 하지 않았다.
- GTM 태그 존재와 GA4 적재 이벤트는 확인했지만, 실제 브라우저 발화 원인은 Preview only에서 확인해야 한다.

## 문서 지도

${markdownTable(
    ["문서", "무엇을 볼 때 쓰나", "왜 필요한가"],
    [
      ["[바이오컴 GTM/GA4 인벤토리](gtm-biocom.md)", "바이오컴 GTM live 태그와 GA4 적재 이벤트를 볼 때", "바이오컴 전환/장바구니/구매 이벤트 기준을 한 곳에 고정"],
      ["[더클린커피 GTM/GA4 인벤토리](gtm-thecleancoffee.md)", "더클린커피 GTM live 태그와 GA4 적재 이벤트를 볼 때", "HURDLERS 태그와 GA4 중간 이벤트 gap을 분리"],
      ["[GTM Preview 전용 체크리스트](gtm-preview-only-checklist.md)", "GTM Preview를 실제로 열기 전", "Preview와 Publish를 혼동하지 않고 발화만 검증"],
    ],
  )}

## 현재 live 기준 요약

${markdownTable(
    ["site", "GTM", "live version", "live tags", "GA4 source", "GA4 export window", "GA4 event_names"],
    inventories.map((inventory) => [
      inventory.site.key,
      inventory.gtm.publicId,
      `${inventory.gtm.liveVersionId} (${inventory.gtm.liveVersionName})`,
      inventory.gtm.tagCount,
      inventory.ga4.source,
      `${inventory.ga4.startDate}~${inventory.ga4.endDate} (${inventory.ga4.dailyTableCount} tables)`,
      inventory.ga4.events.length,
    ]),
  )}

## 운영 원칙

1. GTM 태그 이름은 관리자용 라벨이다. GA4 분석에는 \`event_name\`을 기준으로 본다.
2. Preview는 확인 도구이고, Submit/Create version/Publish는 운영 변경이다.
3. 구매완료 판단은 GA4 이벤트만으로 하지 않는다. 결제완료 원장과 광고 evidence를 분리한다.
4. NPay 클릭/장바구니/결제 시작/결제수단 선택은 구매 전 선행지표다. 실제 구매와 섞지 않는다.
`;

const generatePreviewDoc = () => `# GTM Preview 전용 체크리스트

작성 시각: ${nowKst()} KST
기준일: 2026-05-17
문서 성격: GTM Preview-only runbook

\`\`\`yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  lane: Yellow for actual Preview, Green for this checklist
  allowed_actions:
    - documentation_update
    - preview_plan
  forbidden_actions:
    - gtm_submit_create_version_publish
    - ga4_measurement_protocol_send
    - platform_send_or_upload
    - operating_db_write
    - vm_cloud_deploy
source_window_freshness_confidence:
  source: GTM API live version + GA4 BigQuery aggregate inventory
  window: Preview checklist only, no runtime firing yet
  freshness: generated ${nowKst()} KST
  confidence: high for guardrails, medium for runtime causes until Preview evidence
\`\`\`

## 10초 요약

- Preview는 사이트 코드를 바꾸기 전, 실제 화면에서 어떤 태그가 발화되는지만 보는 검사다.
- 이 문서는 바이오컴과 더클린커피 모두에 적용한다.
- Submit, Create version, Publish는 이 문서 범위 밖이다.
- 성공 기준은 “태그가 있다”가 아니라 “실제 고객 흐름에서 원하는 이벤트가 Fired되고, 원하지 않는 purchase가 Fired되지 않는다”이다.

## 공통 금지선

${markdownTable(
    ["금지", "이유"],
    [
      ["GTM Submit/Create version/Publish", "운영 tracking 변경"],
      ["GA4 Measurement Protocol send", "GA4 전환값 오염"],
      ["Meta/Google/TikTok/Naver 전환 전송", "광고 학습/ROAS 오염"],
      ["실제 결제 테스트", "비용/주문/고객 영향. 별도 Red 승인 필요"],
      ["운영DB write/import", "개발팀 관리 원장 오염"],
    ],
  )}

## Preview 시작 전

1. GTM에서 대상 컨테이너를 정확히 고른다.
   - 바이오컴: \`GTM-W2Z6PHN\`
   - 더클린커피: \`GTM-5M33GC4\`
2. Workspace가 live 최신 기준인지 확인한다.
3. Preview 버튼을 누른 뒤 시작 URL을 넣는다.
4. Tag Assistant가 연결되면 왼쪽 이벤트 타임라인을 열어 둔다.
5. Network 탭은 보조 증거로만 본다. 최종 판단은 Tag Assistant Fired/Not Fired와 GA4 DebugView/BigQuery 후속 확인을 같이 본다.

## 바이오컴 체크 흐름

${biocomPreviewChecklist()}

## 더클린커피 체크 흐름

${coffeePreviewChecklist()}

## 결과 기록 양식

${markdownTable(
    ["site", "화면/행동", "기대 이벤트", "Fired 태그", "Not Fired 태그", "원하지 않는 purchase", "판정", "다음 확인"],
    [
      ["biocom", "상품 상세 진입", "view_item", "", "", "0", "", ""],
      ["biocom", "장바구니 담기", "add_to_cart", "", "", "0", "", ""],
      ["thecleancoffee", "주문서 작성", "begin_checkout", "", "", "0", "", ""],
      ["thecleancoffee", "NPay 클릭", "add_payment_info 또는 intent", "", "", "0", "", ""],
    ],
  )}

## 실패 해석

1. 태그가 있는데 Fired가 안 되면 GTM 설정 문제가 아니라 트리거/DOM/dataLayer 조건 문제일 가능성이 높다.
2. GA4 BigQuery에 0이면 Preview에서 한 번 Fired되는지부터 본다.
3. NPay 클릭에서 purchase가 Fired되면 즉시 publish 금지 상태로 원인만 기록한다.
4. purchase가 정상 완료 URL에서만 Fired되면 다음은 결제완료 원장과 중복/금액 guard를 확인한다.
`;

const buildInventory = async (site: SiteConfig): Promise<SiteInventory> => {
  const [gtm, bq] = [createTagManager(), createBigQuery()];
  const live = await getLiveContainerVersion(gtm, site.gtmPublicId);
  const window = await availableExportWindow(bq, site);
  const rows = await runQuery(bq, ga4EventQuery(site, window.startSuffix, window.endSuffix));
  const events = rows.map<EventSummary>((row) => ({
    event_name: String(row.event_name || ""),
    events: Number(row.events || 0),
    users: Number(row.users || 0),
    sessions: Number(row.sessions || 0),
    cart_page_events: Number(row.cart_page_events || 0),
    checkout_or_payment_page_events: Number(row.checkout_or_payment_page_events || 0),
    product_page_events: Number(row.product_page_events || 0),
    latest_event_at_kst: String(row.latest_event_at_kst || ""),
  }));

  return {
    site,
    gtm: {
      account: live.accountName,
      containerName: live.containerName,
      containerId: live.containerId,
      publicId: live.publicId,
      liveVersionId: live.liveVersionId,
      liveVersionName: live.liveVersionName,
      tagCount: live.tags.length,
      triggerCount: live.triggers.length,
      variableCount: live.variables.length,
      tags: summarizeTags(live.tags, live.triggers),
    },
    ga4: {
      source: `${site.ga4Project}.${site.ga4Dataset}.events_*`,
      latestDailyTable: window.latestDailyTable,
      startDate: window.startDate,
      endDate: window.endDate,
      dailyTableCount: window.dailyTableCount,
      events,
    },
  };
};

const main = async () => {
  const inventories: SiteInventory[] = [];
  for (const site of SITES) {
    inventories.push(await buildInventory(site));
  }

  const dataPath = path.join(REPO_ROOT, "data", "project", `gtm-ga4-full-inventory-${OUTPUT_DATE}.json`);
  await fs.mkdir(path.dirname(dataPath), { recursive: true });
  await fs.writeFile(
    dataPath,
    JSON.stringify(
      {
        ok: true,
        checked_at_kst: `${nowKst()} KST`,
        mode: "green_read_only_gtm_ga4_full_inventory",
        invariants: {
          gtm_publish: 0,
          gtm_submit_create_version: 0,
          ga4_measurement_protocol_send: 0,
          platform_send_or_upload: 0,
          operating_db_write: 0,
          vm_cloud_deploy: 0,
          raw_identifier_output: 0,
        },
        inventories,
      },
      null,
      2,
    ),
    "utf-8",
  );

  await fs.writeFile(path.join(REPO_ROOT, "GA4", "gtm.md"), generateIndexDoc(inventories), "utf-8");
  await fs.writeFile(path.join(REPO_ROOT, "GA4", "gtm-biocom.md"), generateSiteDoc(inventories[0]), "utf-8");
  await fs.writeFile(path.join(REPO_ROOT, "GA4", "gtm-thecleancoffee.md"), generateSiteDoc(inventories[1]), "utf-8");
  await fs.writeFile(path.join(REPO_ROOT, "GA4", "gtm-preview-only-checklist.md"), generatePreviewDoc(), "utf-8");

  console.log(JSON.stringify({ ok: true, dataPath, docs: ["GA4/gtm.md", "GA4/gtm-biocom.md", "GA4/gtm-thecleancoffee.md", "GA4/gtm-preview-only-checklist.md"] }, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
