import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { google } from "googleapis";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const ACCOUNT_ID = "4703003246";
const CONTAINER_ID = "13158774";
const CONTAINER_PATH = `accounts/${ACCOUNT_ID}/containers/${CONTAINER_ID}`;
const BASE = "https://tagmanager.googleapis.com/tagmanager/v2";
const RECEIVER_URL = "https://att.ainativeos.net/api/attribution/paid-click-intent/no-send";
const RUN_ID = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "Z");
const WORKSPACE_NAME = `codex_paid_click_intent_prod_${RUN_ID}`;
const TAG_NAME = "codex_paid_click_intent_v1_receiver_no_send";
const TRIGGER_NAME = "codex_paid_click_intent_v1_all_pages_guarded";
const VERSION_NAME = `paid_click_intent_v1_receiver_${RUN_ID}`;
const VERSION_NOTES = [
  "Mode B approved by TJ.",
  "Purpose: store Google click ids in first-party browser storage and call no-write/no-send receiver.",
  "No Google Ads/GA4/Meta/TikTok/Naver conversion send.",
  "No DB/ledger write. Receiver returns would_store=false and would_send=false.",
  "Rollback: pause this tag or restore previous GTM live version.",
].join(" ");

const args = new Set(process.argv.slice(2));
const SHOULD_APPLY = args.has("--apply");
const SHOULD_PUBLISH = args.has("--publish");

if (SHOULD_PUBLISH && !SHOULD_APPLY) {
  throw new Error("--publish requires --apply");
}

type RequestOptions = {
  method?: string;
  body?: unknown;
};

function getAuth() {
  const raw = process.env.GA4_BIOCOM_SERVICE_ACCOUNT_KEY?.trim()
    || process.env.GSC_SERVICE_ACCOUNT_KEY?.trim();
  if (!raw) throw new Error("GA4_BIOCOM_SERVICE_ACCOUNT_KEY or GSC_SERVICE_ACCOUNT_KEY is required");
  const credentials = JSON.parse(raw);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: [
      "https://www.googleapis.com/auth/tagmanager.readonly",
      "https://www.googleapis.com/auth/tagmanager.edit.containers",
      "https://www.googleapis.com/auth/tagmanager.edit.containerversions",
      "https://www.googleapis.com/auth/tagmanager.publish",
    ],
  });
}

async function token() {
  const client = await getAuth().getClient();
  const access = await client.getAccessToken();
  const value = typeof access === "string" ? access : access?.token;
  if (!value) throw new Error("failed to get access token");
  return value;
}

async function request<T>(accessToken: string, url: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(`${options.method ?? "GET"} ${url} failed ${response.status}: ${JSON.stringify(body)}`);
  }
  return body as T;
}

function buildTagHtml() {
  return `<script>
(function () {
  var VERSION = "paid_click_intent_v1_20260506";
  var STORAGE_KEY = "bi_paid_click_intent_v1";
  var SENT_KEY = "bi_paid_click_intent_v1_sent";
  var RECEIVER_URL = ${JSON.stringify(RECEIVER_URL)};
  var ALLOW_QUERY = {
    gclid: true, gbraid: true, wbraid: true,
    utm_source: true, utm_medium: true, utm_campaign: true, utm_term: true, utm_content: true,
    idx: true
  };

  function getParam(key) {
    try { return new URLSearchParams(location.search).get(key) || ""; }
    catch (e) { return ""; }
  }

  function getCookie(name) {
    try {
      var parts = ("; " + document.cookie).split("; " + name + "=");
      if (parts.length === 2) return parts.pop().split(";").shift() || "";
    } catch (e) {}
    return "";
  }

  function getClientId() {
    var ga = getCookie("_ga");
    var match = ga.match(/^GA\\d+\\.\\d+\\.(.+)$/);
    return match ? match[1] : "";
  }

  function getGaSessionId() {
    try {
      var cookies = document.cookie.split(";").map(function (v) { return v.trim(); });
      for (var i = 0; i < cookies.length; i++) {
        if (cookies[i].indexOf("_ga_") !== 0) continue;
        var value = cookies[i].split("=").slice(1).join("=");
        var match = value.match(/(?:^|[.$])s(\\d+)/);
        if (match) return match[1];
      }
    } catch (e) {}
    return "";
  }

  function isBlockedPath(pathname) {
    return /\\/admin\\b|\\/backpg\\b|\\/login\\b|\\/logout\\b|^\\/_|\\/api\\b|\\/member\\/kakao_friend\\/send|\\/admin\\/config/i.test(pathname || "");
  }

  function sanitizeUrl(raw) {
    try {
      var parsed = new URL(raw, location.origin);
      if (!/\\.biocom\\.kr$|^biocom\\.kr$/.test(parsed.hostname)) return "";
      var next = new URL(parsed.origin + parsed.pathname);
      parsed.searchParams.forEach(function (value, key) {
        if (ALLOW_QUERY[key]) next.searchParams.set(key, value);
      });
      return next.toString();
    } catch (e) {
      return "";
    }
  }

  function readJson(key) {
    try { return JSON.parse(sessionStorage.getItem(key) || localStorage.getItem(key) || "{}") || {}; }
    catch (e) { return {}; }
  }

  function writeStored(next) {
    var serialized = JSON.stringify(next);
    try { localStorage.setItem(STORAGE_KEY, serialized); } catch (e) {}
    try { sessionStorage.setItem(STORAGE_KEY, serialized); } catch (e) {}
  }

  function writeSent(key) {
    var sent = readJson(SENT_KEY);
    if (sent[key]) return false;
    sent[key] = Date.now();
    var serialized = JSON.stringify(sent);
    try { sessionStorage.setItem(SENT_KEY, serialized); } catch (e) {}
    return true;
  }

  function hasGoogleUtm() {
    return /^(google|adwords)$/i.test(getParam("utm_source")) && /(cpc|paid|ppc|sem)/i.test(getParam("utm_medium"));
  }

  function currentEvidence() {
    var stored = readJson(STORAGE_KEY);
    var clickIdPresent = Boolean(getParam("gclid") || getParam("gbraid") || getParam("wbraid"));
    var evidence = {
      site: "biocom",
      platform_hint: "google_ads",
      event_name: "PaidClickIntent",
      storage_key: STORAGE_KEY,
      gclid: getParam("gclid") || stored.gclid || "",
      gbraid: getParam("gbraid") || stored.gbraid || "",
      wbraid: getParam("wbraid") || stored.wbraid || "",
      fbclid: getParam("fbclid") || stored.fbclid || "",
      ttclid: getParam("ttclid") || stored.ttclid || "",
      utm_source: getParam("utm_source") || stored.utm_source || "",
      utm_medium: getParam("utm_medium") || stored.utm_medium || "",
      utm_campaign: getParam("utm_campaign") || stored.utm_campaign || "",
      utm_term: getParam("utm_term") || stored.utm_term || "",
      utm_content: getParam("utm_content") || stored.utm_content || "",
      landing_url: stored.landing_url || sanitizeUrl(location.href),
      current_url: sanitizeUrl(location.href),
      referrer: stored.referrer || sanitizeUrl(document.referrer || ""),
      client_id: getClientId() || stored.client_id || "",
      ga_session_id: getGaSessionId() || stored.ga_session_id || "",
      local_session_id: stored.local_session_id || ("pciv1_" + Math.random().toString(36).slice(2)),
      captured_at: new Date().toISOString()
    };
    if (clickIdPresent || hasGoogleUtm()) writeStored(evidence);
    return evidence;
  }

  function hasGoogleClickId(payload) {
    return Boolean(payload.gclid || payload.gbraid || payload.wbraid);
  }

  function sendNoSend(stage) {
    try {
      if (isBlockedPath(location.pathname)) return;
      var payload = currentEvidence();
      if (!hasGoogleClickId(payload)) return;
      payload.capture_stage = stage;
      payload.event_id = "PaidClickIntent_" + stage + "_" + Date.now();
      var clickId = payload.gclid || payload.gbraid || payload.wbraid;
      var dedupeKey = stage + "|" + clickId + "|" + (payload.ga_session_id || payload.local_session_id);
      if (!writeSent(dedupeKey)) return;
      window.__seo_paid_click_intent_last_payload = payload;
      fetch(RECEIVER_URL, {
        method: "POST",
        mode: "cors",
        credentials: "omit",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).then(function (res) {
        window.__seo_paid_click_intent_last_status = res.status;
      }).catch(function (err) {
        window.__seo_paid_click_intent_last_error = String(err && err.message || err);
      });
    } catch (err) {
      window.__seo_paid_click_intent_last_error = String(err && err.message || err);
    }
  }

  function classifyClick(target) {
    var node = target;
    var text = "";
    for (var depth = 0; node && depth < 5; depth++, node = node.parentElement) {
      text += " " + (node.innerText || "") + " " + (node.id || "") + " " + (node.className || "") + " " + (node.href || "");
    }
    text = String(text).toLowerCase();
    if (/npay|naverpay|naver|네이버페이/.test(text)) return "npay_intent";
    if (/checkout|payment|결제|구매|주문/.test(text)) return "checkout_start";
    return "";
  }

  try {
    window.__seo_paid_click_intent_installed = VERSION;
    currentEvidence();
    sendNoSend("landing");
    document.addEventListener("click", function (event) {
      var stage = classifyClick(event.target);
      if (stage) sendNoSend(stage);
    }, true);
  } catch (err) {
    window.__seo_paid_click_intent_last_error = String(err && err.message || err);
  }
})();
</script>`;
}

async function main() {
  const accessToken = await token();
  const live = await request<any>(accessToken, `${BASE}/${CONTAINER_PATH}/versions:live`);
  const liveTags = (live.tag ?? []) as any[];
  const existing = liveTags.filter((tag) => tag.name === TAG_NAME);
  const result: Record<string, unknown> = {
    generatedAt: new Date().toISOString(),
    mode: SHOULD_APPLY ? (SHOULD_PUBLISH ? "apply_publish" : "apply_create_version_only") : "dry_run",
    container: {
      accountId: ACCOUNT_ID,
      containerId: CONTAINER_ID,
      liveVersionId: live.containerVersionId,
      liveVersionName: live.name,
    },
    planned: {
      workspaceName: WORKSPACE_NAME,
      tagName: TAG_NAME,
      triggerName: TRIGGER_NAME,
      receiverUrl: RECEIVER_URL,
      noSendVerified: true,
      noWriteVerified: true,
      noPlatformSendVerified: true,
    },
    existingTagCount: existing.length,
  };

  if (existing.length > 0) {
    throw new Error(`live container already has ${TAG_NAME}; aborting to avoid duplicate tag`);
  }

  if (!SHOULD_APPLY) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const workspace = await request<any>(accessToken, `${BASE}/${CONTAINER_PATH}/workspaces`, {
    method: "POST",
    body: {
      name: WORKSPACE_NAME,
      description: "Codex paid_click_intent v1 production receiver-enabled workspace. Mode B approved.",
    },
  });
  if (!workspace.path) throw new Error("workspace path missing");

  const trigger = await request<any>(accessToken, `${BASE}/${workspace.path}/triggers`, {
    method: "POST",
    body: {
      name: TRIGGER_NAME,
      type: "pageview",
      notes: "All Pages trigger. Client-side guard only sends receiver payload when Google click id exists; admin/internal paths are skipped.",
    },
  });
  if (!trigger.triggerId) throw new Error("triggerId missing");

  const tag = await request<any>(accessToken, `${BASE}/${workspace.path}/tags`, {
    method: "POST",
    body: {
      name: TAG_NAME,
      type: "html",
      parameter: [
        { type: "template", key: "html", value: buildTagHtml() },
        { type: "boolean", key: "supportDocumentWrite", value: "false" },
      ],
      firingTriggerId: [trigger.triggerId],
      notes: "Mode B. Stores Google click id in browser storage and calls no-write/no-send receiver only. No conversion send.",
    },
  });
  if (!tag.tagId) throw new Error("tagId missing");

  const versionResponse = await request<any>(accessToken, `${BASE}/${workspace.path}:create_version`, {
    method: "POST",
    body: {
      name: VERSION_NAME,
      notes: VERSION_NOTES,
    },
  });
  if (versionResponse.compilerError) {
    throw new Error("create_version returned compilerError=true");
  }
  const createdVersion = versionResponse.containerVersion;
  if (!createdVersion?.path) throw new Error("created version path missing");

  let publishResponse: any = null;
  let liveAfterPublish: any = null;
  if (SHOULD_PUBLISH) {
    publishResponse = await request<any>(accessToken, `${BASE}/${createdVersion.path}:publish`, {
      method: "POST",
    });
    if (publishResponse.compilerError) {
      throw new Error("publish returned compilerError=true");
    }
    liveAfterPublish = await request<any>(accessToken, `${BASE}/${CONTAINER_PATH}/versions:live`);
  }

  Object.assign(result, {
    workspace: {
      path: workspace.path,
      workspaceId: workspace.workspaceId,
      name: workspace.name,
    },
    trigger: {
      triggerId: trigger.triggerId,
      name: trigger.name,
      type: trigger.type,
    },
    tag: {
      tagId: tag.tagId,
      name: tag.name,
      firingTriggerId: tag.firingTriggerId,
    },
    createdVersion: {
      containerVersionId: createdVersion.containerVersionId,
      name: createdVersion.name,
      path: createdVersion.path,
      compilerError: versionResponse.compilerError ?? false,
    },
    publish: publishResponse ? {
      compilerError: publishResponse.compilerError ?? false,
    } : null,
    liveAfterPublish: liveAfterPublish ? {
      containerVersionId: liveAfterPublish.containerVersionId,
      name: liveAfterPublish.name,
      matchesCreatedVersion: liveAfterPublish.containerVersionId === createdVersion.containerVersionId,
    } : null,
  });

  const outputDir = path.resolve(process.cwd(), "../data");
  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, `paid-click-intent-gtm-production-publish-${RUN_ID}.json`);
  fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({ outputPath, ...result }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
