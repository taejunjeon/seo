import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { google } from "googleapis";

dotenv.config({ path: path.resolve(process.cwd(), ".env"), quiet: true });
dotenv.config({ path: path.resolve(process.cwd(), "backend/.env"), override: false, quiet: true });

const ACCOUNT_ID = "4703003246";
const CONTAINER_ID = "13158774";
const CONTAINER_PUBLIC_ID = "GTM-W2Z6PHN";
const CONTAINER_PATH = `accounts/${ACCOUNT_ID}/containers/${CONTAINER_ID}`;
const ENDPOINT =
  process.env.PATH_B_ORDER_BRIDGE_CANARY_RECEIVER_URL?.trim()
  || "https://att.ainativeos.net/api/attribution/order-bridge/identity-hmac/no-send";
const SUMMARY_ENDPOINT = "https://att.ainativeos.net/api/attribution/order-bridge/ledger/summary";
const REPO_ROOT = path.basename(process.cwd()) === "backend" ? path.resolve(process.cwd(), "..") : process.cwd();
const OUTPUT_DIR = path.resolve(REPO_ROOT, "data");
const RUN_ID = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "Z");
const WORKSPACE_NAME = `AGENT_OS_path_b_identity_first_canary_${RUN_ID}`;
const TAG_NAME = `AGENT_OS_path_b_identity_first_hmac_write_canary_${RUN_ID}`;
const TRIGGER_NAME = `AGENT_OS_path_b_order_complete_only_canary_${RUN_ID}`;
const PAYMENT_COMPLETE_PATH_REGEX = "^/shop_payment_complete$";

type SummaryBody = {
  ok?: boolean;
  summary?: Record<string, unknown>;
  source?: Record<string, unknown>;
};

const argValue = (name: string) => {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : "";
};

const mode = argValue("mode") || "publish";

const kstTimestamp = () =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date()).replace(" ", "T");

const getAuth = () => {
  const raw = process.env.GA4_BIOCOM_SERVICE_ACCOUNT_KEY?.trim()
    || process.env.GSC_SERVICE_ACCOUNT_KEY?.trim();
  if (!raw) throw new Error("GA4_BIOCOM_SERVICE_ACCOUNT_KEY 또는 GSC_SERVICE_ACCOUNT_KEY가 필요합니다.");
  return new google.auth.GoogleAuth({
    credentials: JSON.parse(raw),
    scopes: [
      "https://www.googleapis.com/auth/tagmanager.readonly",
      "https://www.googleapis.com/auth/tagmanager.edit.containers",
      "https://www.googleapis.com/auth/tagmanager.edit.containerversions",
      "https://www.googleapis.com/auth/tagmanager.publish",
    ],
  });
};

const fetchSummary = async (): Promise<SummaryBody> => {
  const response = await fetch(SUMMARY_ENDPOINT);
  const text = await response.text();
  if (!response.ok) throw new Error(`summary_http_${response.status}: ${text.slice(0, 120)}`);
  return JSON.parse(text) as SummaryBody;
};

const writeJson = (filePath: string, value: unknown) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const outputPath = (suffix: string) => path.join(OUTPUT_DIR, `path-b-identity-first-canary-${suffix}-${RUN_ID}.json`);

const buildTagHtml = () => `<script>
(function () {
  var VERSION = "agent_os_path_b_identity_first_canary_${RUN_ID}";
  var ENDPOINT = ${JSON.stringify(ENDPOINT)};
  var MAX_BODY_BYTES = 12 * 1024;
  var LEGACY_USER_ID = clean("{{HURDLERS - [맞춤 JS] user_id}}");
  var STORAGE_KEYS = ["bi_paid_click_intent_v1", "__bs_imweb", "__pathb_order_bridge_preview"];

  function clean(value) {
    var text = value == null ? "" : String(value).trim();
    if (!text || /^(undefined|null)$/i.test(text)) return "";
    return text;
  }

  function isOrderCompletePage() {
    return location.hostname === "biocom.kr" && location.pathname === "/shop_payment_complete";
  }

  function pushResult(name, data) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(Object.assign({
      event: name,
      agent_os_path_b_canary_version: VERSION,
      email_source_candidate: LEGACY_USER_ID ? "legacy_user_id" : "none",
      would_send: false
    }, data || {}));
  }

  function text(selector) {
    var el = document.querySelector(selector);
    return el && "value" in el ? clean(el.value) : clean(el && el.textContent);
  }

  function searchParam(keys, urlLike) {
    try {
      var url = new URL(urlLike || location.href, location.origin);
      for (var i = 0; i < keys.length; i += 1) {
        var value = clean(url.searchParams.get(keys[i]));
        if (value) return value;
      }
    } catch (e) {}
    return "";
  }

  function dataLayerLast(keys) {
    var dl = window.dataLayer || [];
    for (var i = dl.length - 1; i >= 0; i -= 1) {
      for (var j = 0; j < keys.length; j += 1) {
        var value = dl[i] && dl[i][keys[j]];
        if (clean(value)) return clean(value);
      }
    }
    return "";
  }

  function readJsonStorage(key) {
    try {
      var raw = window.localStorage && window.localStorage.getItem(key);
      if (!raw) raw = window.sessionStorage && window.sessionStorage.getItem(key);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function storageFirst(keys) {
    for (var i = 0; i < STORAGE_KEYS.length; i += 1) {
      var obj = readJsonStorage(STORAGE_KEYS[i]);
      for (var j = 0; j < keys.length; j += 1) {
        var value = clean(obj && obj[keys[j]]);
        if (value) return value;
      }
    }
    return "";
  }

  function gaClientId() {
    var match = document.cookie.match(/(?:^|; )_ga=GA\\d\\.\\d\\.(\\d+\\.\\d+)/);
    return match ? match[1] : "";
  }

  function gaSessionId() {
    try {
      var cookies = document.cookie.split(";").map(function (v) { return v.trim(); });
      for (var i = 0; i < cookies.length; i += 1) {
        if (cookies[i].indexOf("_ga_") !== 0) continue;
        var value = cookies[i].split("=").slice(1).join("=");
        var match = value.match(/(?:^|[.$])s(\\d+)/);
        if (match) return match[1];
      }
    } catch (e) {}
    return "";
  }

  try {
    if (!isOrderCompletePage()) {
      pushResult("agent_os_path_b_identity_first_canary_blocked", { reason: "not_order_complete_page" });
      return;
    }

    var payload = {
      site: "biocom",
      capture_stage: "order_confirm_agent_os_identity_first_canary",
      email:
        LEGACY_USER_ID ||
        text(".email-info") ||
        dataLayerLast(["email", "email_buy", "ordererEmail", "buyerEmail"]),
      email_source_candidate: LEGACY_USER_ID ? "legacy_user_id" : "none",
      phone:
        text("[name='ordererCall']") ||
        text("[name='phone']") ||
        dataLayerLast(["phone", "phone_buy", "ordererCall", "buyerPhone"]),
      order_no:
        searchParam(["order_no", "orderNo", "order_id", "orderId", "order_code", "orderCode"]) ||
        searchParam(["order_no", "orderNo", "order_id", "orderId", "order_code", "orderCode"], document.referrer) ||
        dataLayerLast(["order_no", "orderNo", "order_number", "orderNumber", "transaction_id"]) ||
        storageFirst(["order_no", "orderNo", "order_number", "orderNumber", "transaction_id"]),
      client_id:
        dataLayerLast(["client_id", "clientId"]) ||
        storageFirst(["client_id", "clientId"]) ||
        gaClientId(),
      ga_session_id:
        dataLayerLast(["ga_session_id", "gaSessionId"]) ||
        storageFirst(["ga_session_id", "gaSessionId"]) ||
        gaSessionId(),
      local_session_id:
        dataLayerLast(["local_session_id", "localSessionId"]) ||
        storageFirst(["local_session_id", "localSessionId", "commonSessionId", "customSessionId"]),
      click_id:
        searchParam(["gclid", "gbraid", "wbraid", "ttclid", "nclick_id"]) ||
        dataLayerLast(["gclid", "gbraid", "wbraid", "ttclid", "nclick_id"]) ||
        storageFirst(["gclid", "gbraid", "wbraid", "ttclid", "nclick_id"]),
      canary_mode: "identity_first_hash_only_1h"
    };

    var body = JSON.stringify(payload);
    if (body.length > MAX_BODY_BYTES) {
      pushResult("agent_os_path_b_identity_first_canary_blocked", { reason: "client_payload_too_large" });
      return;
    }

    fetch(ENDPOINT, {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: body
    }).then(function (res) {
      return res.text().then(function (textBody) {
        var json = null;
        try { json = JSON.parse(textBody); } catch (e) {}
        var preview = json && json.preview ? json.preview : {};
        var ledger = json && json.ledger ? json.ledger : {};
        pushResult("agent_os_path_b_identity_first_canary_result", {
          response_status: res.status,
          response_ok: !!(json && json.ok),
          identity_source: preview.identity_source || "none",
          row_status: preview.row_status || "",
          would_store: !!(preview.would_store || ledger.stored),
          ledger_stored: !!ledger.stored,
          ledger_deduped: !!ledger.deduped,
          ledger_rejected: !!ledger.rejected,
          ledger_reject_reason: ledger.reason || "",
          would_send: false,
          email_hash_present: !!preview.email_hash_present,
          phone_hash_present: !!preview.phone_hash_present,
          order_no_hash_present: !!preview.order_no_hash_present,
          client_session_present: !!preview.client_session_present,
          click_id_hash_present: !!preview.click_id_hash_present,
          no_raw_echo_verified: !!preview.no_raw_echo_verified,
          no_platform_send_verified: !!preview.no_platform_send_verified,
          platform_send_count: preview.platform_send_count || 0,
          hash_version: preview.hash_version || "",
          source_write_flag_on: !!(json && json.source && json.source.write_flag_on)
        });
      });
    }).catch(function () {
      pushResult("agent_os_path_b_identity_first_canary_error", { error_type: "receiver_fetch_failed" });
    });
  } catch (err) {
    pushResult("agent_os_path_b_identity_first_canary_error", { error_type: "install_failed" });
  }
})();
</script>`;

const createWorkspaceWithCanary = async () => {
  const auth = getAuth();
  const gtm = google.tagmanager({ version: "v2", auth });
  const live = await gtm.accounts.containers.versions.live({ parent: CONTAINER_PATH });
  const previousLiveVersionId = live.data.containerVersionId ?? "";
  const previousLiveVersionPath = `${CONTAINER_PATH}/versions/${previousLiveVersionId}`;
  const previousLiveVersion = {
    id: previousLiveVersionId,
    name: live.data.name ?? "",
    path: previousLiveVersionPath,
  };

  const workspace = await gtm.accounts.containers.workspaces.create({
    parent: CONTAINER_PATH,
    requestBody: {
      name: WORKSPACE_NAME,
      description:
        "AGENT_OS Path B identity-first hash-only 1h canary. Order-complete-only. No platform send.",
    },
  });
  if (!workspace.data.path || !workspace.data.workspaceId) throw new Error("workspace create missing path/workspaceId");

  const trigger = await gtm.accounts.containers.workspaces.triggers.create({
    parent: workspace.data.path,
    requestBody: {
      name: TRIGGER_NAME,
      type: "pageview",
      filter: [
        {
          type: "matchRegex",
          parameter: [
            { type: "template", key: "arg0", value: "{{Page Path}}" },
            { type: "template", key: "arg1", value: PAYMENT_COMPLETE_PATH_REGEX },
            { type: "boolean", key: "ignore_case", value: "true" },
          ],
        },
      ],
      notes: "Canary only. Fires only on /shop_payment_complete. All Pages is forbidden.",
    },
  });
  if (!trigger.data.triggerId) throw new Error("trigger create missing triggerId");

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
        "AGENT_OS Path B 1h canary. Uses legacy user_id as transient email source; endpoint stores hash-only row. No platform send.",
    },
  });
  if (!tag.data.tagId) throw new Error("tag create missing tagId");

  const version = await gtm.accounts.containers.workspaces.create_version({
    path: workspace.data.path,
    requestBody: {
      name: `AGENT_OS Path B identity-first canary ${RUN_ID}`,
      notes:
        "Limited 1h order-complete-only canary. Roll back to prior live version after window.",
    },
  });
  if (version.data.compilerError) throw new Error("gtm_create_version_compiler_error");
  const containerVersion = version.data.containerVersion;
  if (!containerVersion?.path || !containerVersion.containerVersionId) {
    throw new Error("create_version missing containerVersion path/id");
  }

  const publish = await gtm.accounts.containers.versions.publish({
    path: containerVersion.path,
    fingerprint: containerVersion.fingerprint ?? undefined,
  });
  if (publish.data.compilerError) throw new Error("gtm_publish_compiler_error");
  const afterLatest = await gtm.accounts.containers.version_headers.latest({ parent: CONTAINER_PATH });
  return {
    generated_at_kst: kstTimestamp(),
    run_id: RUN_ID,
    mode: "publish",
    container: {
      account_id: ACCOUNT_ID,
      container_id: CONTAINER_ID,
      public_id: CONTAINER_PUBLIC_ID,
      previous_live_version: previousLiveVersion,
      canary_version: {
        id: containerVersion.containerVersionId,
        name: containerVersion.name ?? "",
        path: containerVersion.path,
      },
      live_version_after_publish: {
        id: afterLatest.data.containerVersionId ?? "",
        name: afterLatest.data.name ?? "",
      },
    },
    workspace: {
      id: workspace.data.workspaceId,
      name: workspace.data.name,
      path: workspace.data.path,
      new_workspace_path_after_create_version: version.data.newWorkspacePath ?? null,
    },
    trigger: {
      id: trigger.data.triggerId,
      name: trigger.data.name,
      type: trigger.data.type,
      path_regex: PAYMENT_COMPLETE_PATH_REGEX,
      all_pages: false,
    },
    tag: {
      id: tag.data.tagId,
      name: tag.data.name,
      type: tag.data.type,
      endpoint: ENDPOINT,
      existing_gtm_tag_modified: false,
      existing_gtm_tag_paused_or_deleted: false,
      platform_send: false,
    },
    before_summary: await fetchSummary().catch((error) => ({ ok: false, error: String(error) })),
    forbidden_guards: {
      all_pages_trigger: false,
      existing_tag_pause_delete: false,
      platform_send: false,
      conversion_upload: false,
      raw_storage_or_logging: false,
    },
    verdict: "PUBLISHED_ORDER_COMPLETE_ONLY_CANARY",
  };
};

const rollbackToVersion = async (versionPath: string) => {
  const auth = getAuth();
  const gtm = google.tagmanager({ version: "v2", auth });
  const before = await gtm.accounts.containers.versions.live({ parent: CONTAINER_PATH });
  const version = await gtm.accounts.containers.versions.get({ path: versionPath });
  if (!version.data.path) throw new Error(`rollback version not found: ${versionPath}`);
  const publish = await gtm.accounts.containers.versions.publish({
    path: version.data.path,
    fingerprint: version.data.fingerprint ?? undefined,
  });
  if (publish.data.compilerError) throw new Error("gtm_rollback_publish_compiler_error");
  const after = await gtm.accounts.containers.versions.live({ parent: CONTAINER_PATH });
  return {
    generated_at_kst: kstTimestamp(),
    run_id: RUN_ID,
    mode: "rollback",
    rollback_target: {
      path: version.data.path,
      id: version.data.containerVersionId ?? "",
      name: version.data.name ?? "",
    },
    live_before: {
      id: before.data.containerVersionId ?? "",
      name: before.data.name ?? "",
    },
    live_after: {
      id: after.data.containerVersionId ?? "",
      name: after.data.name ?? "",
    },
    verdict: "ROLLBACK_PUBLISHED",
  };
};

const listWorkspaces = async () => {
  const auth = getAuth();
  const gtm = google.tagmanager({ version: "v2", auth });
  const live = await gtm.accounts.containers.versions.live({ parent: CONTAINER_PATH });
  const latest = await gtm.accounts.containers.version_headers.latest({ parent: CONTAINER_PATH });
  const workspaces = await gtm.accounts.containers.workspaces.list({ parent: CONTAINER_PATH });
  return {
    generated_at_kst: kstTimestamp(),
    mode: "list",
    live_container_version: {
      id: live.data.containerVersionId ?? "",
      name: live.data.name ?? "",
      has_identity_first_canary_tag: (live.data.tag ?? [])
        .some((tag) => (tag.name ?? "").includes("identity_first_hmac_write_canary")),
    },
    latest_created_version: {
      id: latest.data.containerVersionId ?? "",
      name: latest.data.name ?? "",
    },
    workspace_count: workspaces.data.workspace?.length ?? 0,
    workspaces: (workspaces.data.workspace ?? []).map((item) => ({
      id: item.workspaceId,
      name: item.name,
      path: item.path,
    })),
  };
};

const main = async () => {
  if (mode === "publish") {
    const result = await createWorkspaceWithCanary();
    const out = outputPath("publish");
    writeJson(out, result);
    writeJson(path.join(OUTPUT_DIR, "path-b-identity-first-canary-publish-20260509.json"), result);
    console.log(JSON.stringify({ output: out, ...result }, null, 2));
    return;
  }
  if (mode === "rollback") {
    const rollbackPath = argValue("version-path");
    if (!rollbackPath) throw new Error("--version-path is required for rollback");
    const result = await rollbackToVersion(rollbackPath);
    const out = outputPath("rollback");
    writeJson(out, result);
    writeJson(path.join(OUTPUT_DIR, "path-b-identity-first-canary-rollback-20260509.json"), result);
    console.log(JSON.stringify({ output: out, ...result }, null, 2));
    return;
  }
  if (mode === "list") {
    const result = await listWorkspaces();
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  throw new Error(`unknown mode: ${mode}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
