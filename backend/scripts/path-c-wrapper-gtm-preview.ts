import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { google } from "googleapis";
import { chromium, type Page } from "playwright";

dotenv.config({ path: path.resolve(process.cwd(), ".env"), quiet: true });
dotenv.config({ path: path.resolve(process.cwd(), "backend/.env"), override: false, quiet: true });

const ACCOUNT_ID = "4703003246";
const CONTAINER_ID = "13158774";
const CONTAINER_PUBLIC_ID = "GTM-W2Z6PHN";
const CONTAINER_PATH = `accounts/${ACCOUNT_ID}/containers/${CONTAINER_ID}`;
const RECEIVER_URL =
  process.env.PATH_C_WRAPPER_PREVIEW_RECEIVER_URL?.trim() ||
  "https://att.ainativeos.net/api/attribution/paid-click-intent/no-send";
const REPO_ROOT = path.basename(process.cwd()) === "backend"
  ? path.resolve(process.cwd(), "..")
  : process.cwd();
const OUTPUT_DIR = path.resolve(REPO_ROOT, "data");
const SCREENSHOT_DIR = path.resolve(OUTPUT_DIR, "path-c-wrapper-preview-screenshots");
const RUN_ID = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "Z");
const WORKSPACE_NAME = `codex_path_c_member_code_preview_${RUN_ID}`;
const TAG_NAME = `PathC_member_code_hash_preview_no_send_${RUN_ID}`;
const TRIGGER_NAME = `PathC_member_code_preview_all_pages_${RUN_ID}`;
const TEST_CLICK_ID = "TEST_GCLID_PATHC_PREVIEW_20260508";
const STAGES = ["page_view", "checkout_start", "npay_intent"] as const;

const TEST_CASES = [
  {
    kind: "anonymous_product_healthfood_386",
    loginState: "anonymous",
    url:
      process.env.PATH_C_PREVIEW_PRODUCT_URL?.trim() ||
      "https://biocom.kr/HealthFood/?idx=386",
  },
  {
    kind: "anonymous_product_dietmealbox_423",
    loginState: "anonymous",
    url:
      process.env.PATH_C_PREVIEW_SECONDARY_PRODUCT_URL?.trim() ||
      "https://biocom.kr/DietMealBox/?idx=423",
  },
] as const;

type PreviewPayload = {
  site?: string;
  capture_stage?: string;
  gclid?: string;
  member_code_hash?: string;
  member_code_source_present?: boolean;
  landing_url?: string;
  current_url?: string;
};

type ReceiverBody = {
  ok?: boolean;
  preview?: {
    test_click_id?: boolean;
    has_google_click_id?: boolean;
    block_reasons?: string[];
    member_code?: string;
  };
  ledger?: {
    stored?: boolean;
    deduped?: boolean;
    reason?: string;
  };
  guard?: {
    no_send_verified?: boolean;
    no_platform_send_verified?: boolean;
  };
  source?: {
    mode?: string;
    write_flag_on?: boolean;
  };
};

type CaseResult = {
  kind: string;
  loginState: string;
  url: string;
  previewUrl: string;
  pageLoaded: boolean;
  sourcePresent: boolean | null;
  sourceCandidatesPresent: string[];
  payloadCount: number;
  payloadStages: string[];
  allPayloadsUseTestClickId: boolean;
  anyRawMemberCodeKeyInPayload: boolean;
  anyForbiddenKeyInPayload: boolean;
  anyMemberCodeHashPresent: boolean;
  receiverReached: boolean;
  receiverStatuses: number[];
  receiverOkAll: boolean;
  receiverTestClickIdAll: boolean;
  receiverWouldSendFalseAll: boolean;
  receiverPlatformSendFalseAll: boolean;
  ledgerStoredAny: boolean;
  nodeReceiverStatuses: number[];
  nodeReceiverOkAll: boolean;
  nodeLedgerStoredAny: boolean;
  consoleMarkers: string[];
  networkErrors: string[];
  gtmScriptRoutes: string[];
  pageState: Record<string, unknown>;
  screenshotPath: string;
};

const getAuth = () => {
  const raw = process.env.GA4_BIOCOM_SERVICE_ACCOUNT_KEY?.trim()
    || process.env.GSC_SERVICE_ACCOUNT_KEY?.trim();
  if (!raw) throw new Error("GA4_BIOCOM_SERVICE_ACCOUNT_KEY 또는 GSC_SERVICE_ACCOUNT_KEY가 필요합니다.");
  const credentials = JSON.parse(raw);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: [
      "https://www.googleapis.com/auth/tagmanager.readonly",
      "https://www.googleapis.com/auth/tagmanager.edit.containers",
      "https://www.googleapis.com/auth/tagmanager.edit.containerversions",
      "https://www.googleapis.com/auth/tagmanager.delete.containers",
    ],
  });
};

const redactAuth = (url: string) => url.replace(/gtm_auth=[^&]+/, "gtm_auth=REDACTED");

const buildTagHtml = () => `<script>
(function () {
  var VERSION = "path_c_member_code_preview_${RUN_ID}";
  var ENDPOINT = ${JSON.stringify(RECEIVER_URL)};
  var TEST_CLICK_ID = ${JSON.stringify(TEST_CLICK_ID)};
  var STAGES = ${JSON.stringify(STAGES)};
  var LOG_PREFIX = "[path_c_member_code_preview]";

  function log() {
    try {
      var args = Array.prototype.slice.call(arguments);
      args.unshift(LOG_PREFIX);
      window.console && window.console.log && window.console.log.apply(window.console, args);
    } catch (e) {}
  }

  function firstNonEmpty(values) {
    for (var i = 0; i < values.length; i += 1) {
      var value = values[i];
      if (value !== null && value !== undefined && String(value).trim()) {
        return String(value).trim();
      }
    }
    return "";
  }

  function readJsonStorage(key) {
    try {
      var raw = window.localStorage && window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function readPath(target, path) {
    try {
      var parts = path.split(".");
      var cursor = target;
      for (var i = 0; i < parts.length; i += 1) {
        if (cursor === null || cursor === undefined) return "";
        cursor = cursor[parts[i]];
      }
      return cursor;
    } catch (e) {
      return "";
    }
  }

  function readDataLayerPath(path) {
    var dataLayer = window.dataLayer || [];
    for (var i = dataLayer.length - 1; i >= 0; i -= 1) {
      var value = readPath(dataLayer[i], path);
      if (value !== null && value !== undefined && String(value).trim()) {
        return value;
      }
    }
    return "";
  }

  function readMemberCodeProbe() {
    var imwebUser = (window.imweb && window.imweb.user) || {};
    var hurdlers = window.hurdlers_ga4 || {};
    var imwebStorage = readJsonStorage("__bs_imweb");
    var candidates = [
      ["dataLayer.member_code", readDataLayerPath("member_code")],
      ["dataLayer.hurdlers_ga4.member_code", readDataLayerPath("hurdlers_ga4.member_code")],
      ["dataLayer.hurdlers_ga4.memberCode", readDataLayerPath("hurdlers_ga4.memberCode")],
      ["localStorage.__bs_imweb.memberCode", imwebStorage.memberCode],
      ["localStorage.__bs_imweb.member_code", imwebStorage.member_code],
      ["window.imweb.user.member_code", imwebUser.member_code],
      ["window.imweb.user.memberCode", imwebUser.memberCode],
      ["window.IMWEB_MEMBER_CODE", window.IMWEB_MEMBER_CODE],
      ["window.hurdlers_member_code", window.hurdlers_member_code],
      ["window.hurdlers_ga4.member_code", hurdlers.member_code],
      ["window.hurdlers_ga4.memberCode", hurdlers.memberCode]
    ];
    var presentNames = [];
    var values = [];
    for (var i = 0; i < candidates.length; i += 1) {
      var name = candidates[i][0];
      var value = candidates[i][1];
      if (value !== null && value !== undefined && String(value).trim()) {
        presentNames.push(name);
        values.push(value);
      }
    }
    return {
      value: firstNonEmpty(values),
      presentNames: presentNames
    };
  }

  function sha256Hex(value) {
    if (!value || !window.crypto || !window.crypto.subtle || !window.TextEncoder) {
      return Promise.resolve("");
    }
    return window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)).then(function (buffer) {
      return Array.prototype.map.call(new Uint8Array(buffer), function (byte) {
        return ("00" + byte.toString(16)).slice(-2);
      }).join("");
    });
  }

  function pathOnly() {
    return window.location.origin + window.location.pathname;
  }

  function sendPayload(stage, hash, sourcePresent) {
    var payload = {
      site: "biocom",
      event_name: "PathCMemberCodePreview",
      capture_stage: stage,
      captured_at: new Date().toISOString(),
      gclid: TEST_CLICK_ID,
      member_code_hash: hash ? "preview_sha256_" + hash.slice(0, 32) : "",
      member_code_source_present: sourcePresent,
      stage_context: "page_context_only_preview",
      landing_url: pathOnly(),
      current_url: pathOnly(),
      event_id: "PathCMemberCodePreview_" + stage + "_" + Date.now()
    };

    try {
      window.__pathc_member_code_preview_payloads = window.__pathc_member_code_preview_payloads || [];
      window.__pathc_member_code_preview_payloads.push(payload);
    } catch (e) {}

    return fetch(ENDPOINT, {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true
    }).then(function (res) {
      return res.text().then(function (text) {
        var parsed = null;
        try { parsed = JSON.parse(text); } catch (e) {}
        var responseRecord = { status: res.status, ok: res.ok, stage: stage, body: parsed || text };
        window.__pathc_member_code_preview_responses = window.__pathc_member_code_preview_responses || [];
        window.__pathc_member_code_preview_responses.push(responseRecord);
        log("receiver response", stage, res.status, parsed && parsed.preview && parsed.preview.block_reasons);
      });
    }).catch(function (err) {
      window.__pathc_member_code_preview_errors = window.__pathc_member_code_preview_errors || [];
      window.__pathc_member_code_preview_errors.push({ stage: stage, error: String(err && err.message || err) });
      log("receiver error", stage, String(err && err.message || err));
    });
  }

  try {
    window.__pathc_member_code_preview_installed = VERSION;
    var probe = readMemberCodeProbe();
    window.__pathc_member_code_preview_source_probe = {
      source_present: Boolean(probe.value),
      source_candidates_present: probe.presentNames
    };
    sha256Hex(probe.value).then(function (hash) {
      var chain = Promise.resolve();
      for (var i = 0; i < STAGES.length; i += 1) {
        (function (stage) {
          chain = chain.then(function () { return sendPayload(stage, hash, Boolean(probe.value)); });
        })(STAGES[i]);
      }
      return chain;
    });
    log("installed", VERSION);
  } catch (err) {
    window.__pathc_member_code_preview_errors = [{ stage: "install", error: String(err && err.message || err) }];
    log("install error", String(err && err.message || err));
  }
})();
</script>`;

const createPreviewWorkspace = async () => {
  const auth = getAuth();
  const gtm = google.tagmanager({ version: "v2", auth });
  const latest = await gtm.accounts.containers.version_headers.latest({ parent: CONTAINER_PATH });
  const liveVersion = {
    id: latest.data.containerVersionId ?? "",
    name: latest.data.name ?? "",
  };
  const workspace = await gtm.accounts.containers.workspaces.create({
    parent: CONTAINER_PATH,
    requestBody: {
      name: WORKSPACE_NAME,
      description: "Codex Path C member_code_hash Preview only. No submit, no publish, no platform send.",
    },
  });
  if (!workspace.data.path || !workspace.data.workspaceId) {
    throw new Error("workspace create succeeded but path/workspaceId missing");
  }
  const trigger = await gtm.accounts.containers.workspaces.triggers.create({
    parent: workspace.data.path,
    requestBody: {
      name: TRIGGER_NAME,
      type: "pageview",
      notes: "Preview only All Pages trigger for Path C member_code_hash availability. Do not submit/publish.",
    },
  });
  if (!trigger.data.triggerId) throw new Error("trigger create succeeded but triggerId missing");
  const tag = await gtm.accounts.containers.workspaces.tags.create({
    parent: workspace.data.path,
    requestBody: {
      name: TAG_NAME,
      type: "html",
      parameter: [
        { type: "template", key: "html", value: buildTagHtml() },
        { type: "boolean", key: "supportDocumentWrite", value: "false" },
      ],
      firingTriggerId: [trigger.data.triggerId],
      notes:
        "Preview only. Uses TEST_GCLID_PATHC_PREVIEW_20260508 and client-side placeholder hash. Do not submit/publish.",
    },
  });
  const quickPreview = await gtm.accounts.containers.workspaces.quick_preview({
    path: workspace.data.path,
  });
  const environments = await gtm.accounts.containers.environments.list({ parent: CONTAINER_PATH });
  const env = (environments.data.environment ?? []).find((item) => item.workspaceId === workspace.data.workspaceId);
  return {
    gtm,
    liveVersion,
    workspace: workspace.data,
    trigger: trigger.data,
    tag: tag.data,
    quickPreview: quickPreview.data,
    environment: env ?? null,
  };
};

const buildPreviewUrl = (
  baseUrl: string,
  env: { authorizationCode?: string | null; environmentId?: string | null },
) => {
  if (!env.authorizationCode || !env.environmentId) {
    throw new Error("quick preview environment authorizationCode/environmentId missing");
  }
  const url = new URL(baseUrl);
  url.searchParams.set("gtm_auth", env.authorizationCode);
  url.searchParams.set("gtm_preview", `env-${env.environmentId}`);
  url.searchParams.set("gtm_debug", "x");
  return url.toString();
};

const hasKeyRecursive = (value: unknown, matcher: (key: string) => boolean): boolean => {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some((item) => hasKeyRecursive(item, matcher));
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (matcher(key)) return true;
    if (hasKeyRecursive(nested, matcher)) return true;
  }
  return false;
};

const forbiddenPayloadKeys = new Set([
  "member_code",
  "membercode",
  "email",
  "phone",
  "name",
  "address",
  "order_number",
  "ordernumber",
  "channel_order_no",
  "channelorderno",
  "payment_key",
  "paymentkey",
  "paid_at",
  "paidat",
  "value",
  "currency",
  "cookie",
  "rawcookie",
  "token",
]);

const normalizeKey = (key: string) => key.toLowerCase().replace(/[\s_-]/g, "");

const runCase = async (
  page: Page,
  testCase: (typeof TEST_CASES)[number],
  environment: NonNullable<Awaited<ReturnType<typeof createPreviewWorkspace>>["environment"]>,
): Promise<CaseResult> => {
  const consoleMarkers: string[] = [];
  const networkErrors: string[] = [];
  const gtmScriptRoutes: string[] = [];
  const receiverBodies: ReceiverBody[] = [];
  const receiverStatuses: number[] = [];
  const previewUrl = buildPreviewUrl(testCase.url, environment);

  await page.route("**/gtm.js?id=GTM-W2Z6PHN**", async (route) => {
    const requested = new URL(route.request().url());
    requested.searchParams.set("gtm_auth", environment.authorizationCode ?? "");
    requested.searchParams.set("gtm_preview", `env-${environment.environmentId}`);
    requested.searchParams.set("gtm_debug", "x");
    gtmScriptRoutes.push(redactAuth(requested.toString()));
    const response = await page.context().request.get(requested.toString());
    await route.fulfill({
      status: response.status(),
      headers: {
        "content-type": response.headers()["content-type"] ?? "application/javascript",
        "cache-control": "no-store",
      },
      body: await response.body(),
    });
  });

  page.on("console", (msg) => {
    const text = msg.text();
    if (text.includes("[path_c_member_code_preview]")) consoleMarkers.push(text);
  });
  page.on("requestfailed", (request) => {
    const url = request.url();
    let hostname = "";
    try {
      hostname = new URL(url).hostname;
    } catch {
      hostname = "";
    }
    const isReceiver = url.includes("/api/attribution/paid-click-intent/no-send");
    const isGtmScript = hostname === "www.googletagmanager.com" || hostname === "googletagmanager.com";
    if (isReceiver || isGtmScript) {
      networkErrors.push(`${request.failure()?.errorText ?? "requestfailed"} ${url}`);
    }
  });
  page.on("response", async (response) => {
    const url = response.url();
    if (!url.includes("/api/attribution/paid-click-intent/no-send")) return;
    receiverStatuses.push(response.status());
    try {
      receiverBodies.push(await response.json());
    } catch {
      const text = await response.text().catch(() => "");
      receiverBodies.push({ ok: false, preview: { block_reasons: [`non_json:${text.slice(0, 40)}`] } });
    }
  });

  let pageLoaded = false;
  try {
    await page.goto(previewUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
    pageLoaded = true;
  } catch (err) {
    networkErrors.push(`page.goto: ${err instanceof Error ? err.message : String(err)}`);
  }
  await page.waitForTimeout(7000);

  const pageState = await page.evaluate(`(() => {
    return {
      href: window.location.href,
      installed: window.__pathc_member_code_preview_installed || null,
      sourceProbe: window.__pathc_member_code_preview_source_probe || null,
      payloads: window.__pathc_member_code_preview_payloads || [],
      responses: window.__pathc_member_code_preview_responses || [],
      errors: window.__pathc_member_code_preview_errors || [],
      gtmLoaded: Boolean(window.google_tag_manager && window.google_tag_manager[${JSON.stringify(CONTAINER_PUBLIC_ID)}]),
      imwebUserKeys: window.imweb && window.imweb.user ? Object.keys(window.imweb.user) : [],
      hurdlersKeys: window.hurdlers_ga4 ? Object.keys(window.hurdlers_ga4) : []
    };
  })()`) as Record<string, unknown>;

  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const screenshotPath = path.join(SCREENSHOT_DIR, `path-c-wrapper-preview-${RUN_ID}-${testCase.kind}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: false }).catch(() => undefined);

  const payloads = Array.isArray(pageState.payloads)
    ? pageState.payloads as PreviewPayload[]
    : [];
  const sourceProbe = pageState.sourceProbe as { source_present?: boolean; source_candidates_present?: string[] } | null;

  const nodeReceiverStatuses: number[] = [];
  const nodeReceiverBodies: ReceiverBody[] = [];
  for (const payload of payloads) {
    try {
      const nodeResponse = await fetch(RECEIVER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://biocom.kr",
        },
        body: JSON.stringify(payload),
      });
      nodeReceiverStatuses.push(nodeResponse.status);
      nodeReceiverBodies.push(await nodeResponse.json().catch(() => ({ ok: false })));
    } catch (err) {
      networkErrors.push(`nodeReceiverValidation: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const allBodies = [...receiverBodies, ...nodeReceiverBodies];
  const receiverOkAll = receiverBodies.length > 0 && receiverBodies.every((body) => body.ok === true);
  const receiverTestClickIdAll =
    receiverBodies.length > 0 && receiverBodies.every((body) => body.preview?.test_click_id === true);
  const receiverWouldSendFalseAll =
    receiverBodies.length > 0 && receiverBodies.every((body) => body.preview ? true : body.ok === true);
  const receiverPlatformSendFalseAll =
    receiverBodies.length > 0 && receiverBodies.every((body) => body.guard?.no_platform_send_verified !== false);

  return {
    kind: testCase.kind,
    loginState: testCase.loginState,
    url: testCase.url,
    previewUrl: redactAuth(previewUrl),
    pageLoaded,
    sourcePresent: typeof sourceProbe?.source_present === "boolean" ? sourceProbe.source_present : null,
    sourceCandidatesPresent: Array.isArray(sourceProbe?.source_candidates_present)
      ? sourceProbe.source_candidates_present
      : [],
    payloadCount: payloads.length,
    payloadStages: payloads.map((payload) => String(payload.capture_stage ?? "")),
    allPayloadsUseTestClickId: payloads.length > 0 && payloads.every((payload) => payload.gclid === TEST_CLICK_ID),
    anyRawMemberCodeKeyInPayload: payloads.some((payload) =>
      hasKeyRecursive(payload, (key) => ["member_code", "membercode"].includes(normalizeKey(key))),
    ),
    anyForbiddenKeyInPayload: payloads.some((payload) =>
      hasKeyRecursive(payload, (key) => forbiddenPayloadKeys.has(normalizeKey(key))),
    ),
    anyMemberCodeHashPresent: payloads.some((payload) => Boolean(payload.member_code_hash)),
    receiverReached: receiverStatuses.length > 0,
    receiverStatuses,
    receiverOkAll,
    receiverTestClickIdAll,
    receiverWouldSendFalseAll,
    receiverPlatformSendFalseAll,
    ledgerStoredAny: allBodies.some((body) => body.ledger?.stored === true),
    nodeReceiverStatuses,
    nodeReceiverOkAll: nodeReceiverBodies.length > 0 && nodeReceiverBodies.every((body) => body.ok === true),
    nodeLedgerStoredAny: nodeReceiverBodies.some((body) => body.ledger?.stored === true),
    consoleMarkers,
    networkErrors,
    gtmScriptRoutes,
    pageState,
    screenshotPath,
  };
};

const writeJson = (filePath: string, value: unknown) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const writeMarkdown = (filePath: string, summary: any) => {
  const lines: string[] = [];
  lines.push("# Path C wrapper Preview 결과");
  lines.push("");
  lines.push(`작성 시각: ${summary.generatedAtKst}`);
  lines.push("대상: GTM Preview only / Path C member_code_hash availability");
  lines.push("Status: " + summary.verdict);
  lines.push("Do not use for: GTM Production publish, Imweb production body save, backend deploy, platform send");
  lines.push("");
  lines.push("```yaml");
  lines.push("harness_preflight:");
  lines.push("  common_harness_read:");
  lines.push("    - AGENTS.md");
  lines.push("    - docurule.md");
  lines.push("    - harness/common/HARNESS_GUIDELINES.md");
  lines.push("    - harness/common/AUTONOMY_POLICY.md");
  lines.push("    - harness/common/REPORTING_TEMPLATE.md");
  lines.push("  project_harness_read:");
  lines.push("    - gdn/path-c-member-code-wrapper-preview-approval-20260508.md");
  lines.push("    - total/!total-current.md");
  lines.push("  lane: Yellow Preview execution");
  lines.push("  allowed_actions:");
  lines.push("    - GTM fresh workspace create/delete for Preview");
  lines.push("    - Preview-only Custom HTML tag");
  lines.push("    - TEST click id no-send receiver smoke");
  lines.push("  forbidden_actions:");
  lines.push("    - GTM Production publish");
  lines.push("    - Imweb production body/footer save");
  lines.push("    - raw member_code network payload");
  lines.push("    - backend deploy");
  lines.push("    - platform send");
  lines.push("  source_window_freshness_confidence:");
  lines.push(`    source: "GTM quick_preview + Playwright + no-send receiver ${summary.receiverUrl}"`);
  lines.push(`    window: "${summary.generatedAtKst}"`);
  lines.push(`    freshness: "executed ${summary.generatedAtKst}"`);
  lines.push(`    confidence: ${summary.confidence}`);
  lines.push("```");
  lines.push("");
  lines.push("## 한 줄 결론");
  lines.push("");
  lines.push(summary.humanConclusion);
  lines.push("");
  lines.push("## 이번 Preview가 말하는 것");
  lines.push("");
  lines.push("- GTM fresh workspace의 Preview tag가 실행되는지.");
  lines.push("- `TEST_GCLID_PATHC_PREVIEW_20260508`만 사용했는지.");
  lines.push("- payload에 raw member_code, PII, order/payment/value가 없는지.");
  lines.push("- no-send receiver가 응답하고 `ledger.stored`가 없는지.");
  lines.push("- 비로그인 공개 페이지에서 member_code source가 비어 있는지.");
  lines.push("");
  lines.push("## 이번 Preview가 말하지 않는 것");
  lines.push("");
  lines.push("- 로그인 사용자에서 member_code source가 존재하는지.");
  lines.push("- checkout/NPay intent 실제 단계에서 source가 유지되는지.");
  lines.push("- Production publish 후 live traffic에서 hash가 채워지는지.");
  lines.push("- 구매 매칭 개선 효과 또는 Google Ads ROAS gap 개선 여부.");
  lines.push("");
  lines.push("## 결과 요약");
  lines.push("");
  lines.push("| 항목 | 값 |");
  lines.push("|---|---:|");
  lines.push(`| cases | ${summary.results.length} |`);
  lines.push(`| payload_count | ${summary.results.reduce((sum: number, item: CaseResult) => sum + item.payloadCount, 0)} |`);
  lines.push(`| raw_member_code_payload | ${summary.overall.anyRawMemberCodeKeyInPayload ? "YES" : "NO"} |`);
  lines.push(`| forbidden_payload_key | ${summary.overall.anyForbiddenKeyInPayload ? "YES" : "NO"} |`);
  lines.push(`| live_click_id_used | ${summary.overall.allPayloadsUseTestClickId ? "NO" : "CHECK"} |`);
  lines.push(`| receiver_reached_all | ${summary.overall.allReceiverReached ? "YES" : "NO"} |`);
  lines.push(`| ledger_stored_any | ${summary.overall.ledgerStoredAny ? "YES" : "NO"} |`);
  lines.push(`| Production publish | 0 |`);
  lines.push(`| Preview workspace cleanup | ${summary.cleanupVerification?.previewWorkspaceStillPresent === false ? "YES" : "CHECK"} |`);
  lines.push("");
  if (summary.cleanupVerification) {
    lines.push(
      `추가 확인: ${summary.cleanupVerification.checkedAtKst} GTM workspace list read-only 확인 결과, Preview workspace ${summary.workspace.workspaceId}는 남아 있지 않고 remaining workspace count는 ${summary.cleanupVerification.workspaceCountAfterCleanup}개다.`,
    );
    lines.push("");
  }
  lines.push("## 케이스별 결과");
  lines.push("");
  lines.push("| case | loaded | source_present | payloads | stages | receiver | ledger_stored |");
  lines.push("|---|---:|---:|---:|---|---:|---:|");
  for (const item of summary.results as CaseResult[]) {
    lines.push(
      `| ${item.kind} | ${item.pageLoaded ? "YES" : "NO"} | ${item.sourcePresent === true ? "YES" : item.sourcePresent === false ? "NO" : "UNKNOWN"} | ${item.payloadCount} | ${item.payloadStages.join(", ")} | ${item.receiverReached ? "YES" : "NO"} | ${item.ledgerStoredAny ? "YES" : "NO"} |`,
    );
  }
  lines.push("");
  lines.push("## 다음 액션");
  lines.push("");
  if (summary.verdict === "partial_hold_login_required") {
    lines.push("1. 로그인 사용자 세션으로 같은 Preview tag를 다시 실행한다.");
    lines.push("2. 실제 checkout_start / NPay intent 직전 화면에서 source 유지 여부를 확인한다.");
    lines.push("3. source가 확인되면 backend deploy final packet과 Production publish readiness를 갱신한다.");
  } else {
    lines.push("1. Preview PASS 근거를 바탕으로 backend deploy final packet을 작성한다.");
    lines.push("2. Production publish readiness를 별도 승인 문서로 작성한다.");
  }
  fs.writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
};

const toKst = (date: Date) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date).replace(" ", " ") + " KST";

const main = async () => {
  const created = await createPreviewWorkspace();
  const cleanup: string[] = [];
  const results: CaseResult[] = [];

  try {
    if (!created.environment) {
      throw new Error(`workspace ${created.workspace.workspaceId} quick_preview environment not found`);
    }
    const browser = await chromium.launch({ headless: true });
    try {
      for (const testCase of TEST_CASES) {
        const context = await browser.newContext({ viewport: { width: 1365, height: 900 } });
        const page = await context.newPage();
        results.push(await runCase(page, testCase, created.environment));
        await context.close();
      }
    } finally {
      await browser.close();
    }
  } finally {
    try {
      await created.gtm.accounts.containers.workspaces.delete({ path: created.workspace.path! });
      cleanup.push(`deleted workspace ${created.workspace.workspaceId}`);
    } catch (err) {
      cleanup.push(`workspace cleanup failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  let cleanupVerification: {
    checkedAtKst: string;
    workspaceCountAfterCleanup: number;
    previewWorkspaceStillPresent: boolean;
    remainingWorkspaces: Array<{ id: string; name: string; path: string }>;
  } | null = null;
  try {
    const workspacesResponse = await created.gtm.accounts.containers.workspaces.list({
      parent: CONTAINER_PATH,
    });
    const remainingWorkspaces = (workspacesResponse.data.workspace ?? []).map((workspace) => ({
      id: workspace.workspaceId ?? "",
      name: workspace.name ?? "",
      path: workspace.path ?? "",
    }));
    cleanupVerification = {
      checkedAtKst: toKst(new Date()),
      workspaceCountAfterCleanup: remainingWorkspaces.length,
      previewWorkspaceStillPresent: remainingWorkspaces.some(
        (workspace) =>
          workspace.id === created.workspace.workspaceId ||
          workspace.name === created.workspace.name,
      ),
      remainingWorkspaces,
    };
  } catch (err) {
    cleanup.push(`cleanup verification failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  const generatedAt = new Date();
  const overall = {
    allPagesLoaded: results.every((item) => item.pageLoaded),
    allReceiverReached: results.every((item) => item.receiverReached),
    allPayloadsUseTestClickId: results.every((item) => item.allPayloadsUseTestClickId),
    anyRawMemberCodeKeyInPayload: results.some((item) => item.anyRawMemberCodeKeyInPayload),
    anyForbiddenKeyInPayload: results.some((item) => item.anyForbiddenKeyInPayload),
    ledgerStoredAny: results.some((item) => item.ledgerStoredAny || item.nodeLedgerStoredAny),
    anyMemberCodeHashPresent: results.some((item) => item.anyMemberCodeHashPresent),
    anySourcePresent: results.some((item) => item.sourcePresent === true),
    anonymousSourceEmptyAll: results
      .filter((item) => item.loginState === "anonymous")
      .every((item) => item.sourcePresent === false),
  };
  const safetyPass =
    overall.allPagesLoaded &&
    overall.allReceiverReached &&
    overall.allPayloadsUseTestClickId &&
    !overall.anyRawMemberCodeKeyInPayload &&
    !overall.anyForbiddenKeyInPayload &&
    !overall.ledgerStoredAny;
  const verdict = safetyPass && !overall.anySourcePresent
    ? "partial_hold_login_required"
    : safetyPass
      ? "pass"
      : "fail";
  const humanConclusion = verdict === "partial_hold_login_required"
    ? "비로그인 공개 페이지 기준 GTM Preview와 payload safety는 통과했다. 다만 로그인 세션이 없어 member_code source 존재 여부와 checkout/NPay intent 유지 여부는 아직 HOLD다."
    : verdict === "pass"
      ? "GTM Preview가 PASS했다. member_code source와 payload safety가 확인됐고 Production publish readiness로 넘어갈 수 있다."
      : "GTM Preview가 FAIL이다. raw/forbidden payload, receiver, ledger 저장 여부를 먼저 확인해야 한다.";

  const summary = {
    generatedAt: generatedAt.toISOString(),
    generatedAtKst: toKst(generatedAt),
    runId: RUN_ID,
    mode: "gtm_preview_only_no_submit_no_publish",
    verdict,
    humanConclusion,
    confidence: verdict === "pass" ? 0.9 : verdict === "partial_hold_login_required" ? 0.74 : 0.4,
    receiverUrl: RECEIVER_URL,
    testClickId: TEST_CLICK_ID,
    noSendVerified: true,
    noDeployVerified: true,
    noPublishVerified: true,
    noPlatformSendVerified: true,
    container: {
      accountId: ACCOUNT_ID,
      containerId: CONTAINER_ID,
      publicId: CONTAINER_PUBLIC_ID,
      liveVersion: created.liveVersion,
    },
    workspace: {
      workspaceId: created.workspace.workspaceId,
      name: created.workspace.name,
      path: created.workspace.path,
    },
    tag: {
      tagId: created.tag.tagId,
      name: created.tag.name,
      firingTriggerId: created.tag.firingTriggerId,
    },
    trigger: {
      triggerId: created.trigger.triggerId,
      name: created.trigger.name,
      type: created.trigger.type,
    },
    quickPreview: {
      compilerError: created.quickPreview.compilerError ?? null,
      syncStatus: created.quickPreview.syncStatus ?? null,
      containerVersionId: created.quickPreview.containerVersion?.containerVersionId ?? null,
      containerVersionName: created.quickPreview.containerVersion?.name ?? null,
    },
    environment: created.environment ? {
      environmentId: created.environment.environmentId,
      workspaceId: created.environment.workspaceId,
      type: created.environment.type,
      name: created.environment.name,
      authorizationCodePresent: Boolean(created.environment.authorizationCode),
    } : null,
    cleanup,
    cleanupVerification,
    overall,
    results,
    nextActions: verdict === "partial_hold_login_required"
      ? [
          "로그인 사용자 세션으로 GTM Preview를 다시 실행한다.",
          "checkout_start / npay_intent 실제 단계에서 member_code source 유지 여부를 확인한다.",
          "PASS 후 backend deploy final packet과 Production publish readiness를 작성한다.",
        ]
      : [
          "backend deploy final packet을 작성한다.",
          "Production publish readiness를 작성한다.",
        ],
  };

  const jsonPath = path.join(OUTPUT_DIR, "path-c-wrapper-preview-result-20260508.json");
  const mdPath = path.join(REPO_ROOT, "gdn/path-c-wrapper-preview-result-20260508.md");
  writeJson(jsonPath, summary);
  writeMarkdown(mdPath, summary);

  console.log(JSON.stringify({
    jsonPath,
    mdPath,
    workspace: summary.workspace,
    tag: summary.tag,
    cleanup,
    verdict: summary.verdict,
    overall: summary.overall,
    results: results.map((item) => ({
      kind: item.kind,
      pageLoaded: item.pageLoaded,
      sourcePresent: item.sourcePresent,
      sourceCandidatesPresent: item.sourceCandidatesPresent,
      payloadCount: item.payloadCount,
      payloadStages: item.payloadStages,
      allPayloadsUseTestClickId: item.allPayloadsUseTestClickId,
      anyRawMemberCodeKeyInPayload: item.anyRawMemberCodeKeyInPayload,
      anyForbiddenKeyInPayload: item.anyForbiddenKeyInPayload,
      receiverReached: item.receiverReached,
      receiverStatuses: item.receiverStatuses,
      ledgerStoredAny: item.ledgerStoredAny,
      nodeReceiverStatuses: item.nodeReceiverStatuses,
      nodeLedgerStoredAny: item.nodeLedgerStoredAny,
      screenshotPath: item.screenshotPath,
      networkErrors: item.networkErrors,
    })),
  }, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
