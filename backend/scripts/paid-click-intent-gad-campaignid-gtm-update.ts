import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { google } from "googleapis";

const repoRoot = path.resolve(process.cwd(), process.cwd().endsWith("/backend") ? ".." : ".");
const backendDir = path.join(repoRoot, "backend");

dotenv.config({ path: path.join(repoRoot, ".env"), quiet: true });
dotenv.config({ path: path.join(backendDir, ".env"), override: false, quiet: true });

const ACCOUNT_ID = "4703003246";
const CONTAINER_ID = "13158774";
const CONTAINER_PUBLIC_ID = "GTM-W2Z6PHN";
const CONTAINER_PATH = `accounts/${ACCOUNT_ID}/containers/${CONTAINER_ID}`;
const BASE = "https://tagmanager.googleapis.com/tagmanager/v2";
const TAG_ID = "279";
const TRIGGER_ID = "278";
const RUN_ID = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "Z");
const HTML_SOURCE_PATH = process.env.GTM_PAID_CLICK_INTENT_HTML_PATH?.trim() || "";
const WORKSPACE_NAME = HTML_SOURCE_PATH
  ? `codex_paid_click_intent_v3_stale_click_guard_preview_${RUN_ID}`
  : `codex_paid_click_intent_gad_campaignid_preview_${RUN_ID}`;
const RECEIVER_URL = "https://att.ainativeos.net/api/attribution/paid-click-intent/no-send";
const SHOULD_APPLY = process.argv.includes("--apply");

type RequestOptions = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
};

const credentialsJson =
  process.env.GA4_BIOCOM_SERVICE_ACCOUNT_KEY?.trim()
  || process.env.GSC_SERVICE_ACCOUNT_KEY?.trim();

if (!credentialsJson) {
  throw new Error("GA4_BIOCOM_SERVICE_ACCOUNT_KEY or GSC_SERVICE_ACCOUNT_KEY is required");
}

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(credentialsJson),
  scopes: [
    "https://www.googleapis.com/auth/tagmanager.readonly",
    "https://www.googleapis.com/auth/tagmanager.edit.containers",
  ],
});

async function accessToken() {
  const client = await auth.getClient();
  const access = await client.getAccessToken();
  const token = typeof access === "string" ? access : access?.token;
  if (!token) throw new Error("failed to get Google API access token");
  return token;
}

async function gtmRequest<T>(token: string, url: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
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

function getHtmlParam(tag: any): string {
  const htmlParam = (tag.parameter ?? []).find((param: any) => param.key === "html");
  if (!htmlParam?.value || typeof htmlParam.value !== "string") {
    throw new Error(`tag ${tag.tagId ?? TAG_ID} html parameter missing`);
  }
  return htmlParam.value;
}

function setHtmlParam(tag: any, html: string) {
  const htmlParam = (tag.parameter ?? []).find((param: any) => param.key === "html");
  if (!htmlParam) throw new Error(`tag ${tag.tagId ?? TAG_ID} html parameter missing`);
  htmlParam.value = html;
}

function sha256(value: string) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function writeFile(relativePath: string, content: string) {
  const outPath = path.join(repoRoot, relativePath);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, content, "utf8");
  return outPath;
}

function buildUpdatedHtml() {
  if (HTML_SOURCE_PATH) {
    const sourcePath = path.isAbsolute(HTML_SOURCE_PATH)
      ? HTML_SOURCE_PATH
      : path.join(repoRoot, HTML_SOURCE_PATH);
    return fs.readFileSync(sourcePath, "utf8");
  }

  return `<script>
(function () {
  var VERSION = "paid_click_intent_v2_gad_campaignid_20260521";
  var STORAGE_KEY = "bi_paid_click_intent_v1";
  var SENT_KEY = "bi_paid_click_intent_v1_sent";
  var RECEIVER_URL = ${JSON.stringify(RECEIVER_URL)};
  var ALLOW_QUERY = {
    gclid: true, gbraid: true, wbraid: true,
    gad_source: true, gad_campaignid: true, utm_id: true,
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

  function hasIncomingGoogleEvidence(clickIdPresent, googleUtmPresent) {
    return Boolean(
      clickIdPresent ||
      googleUtmPresent ||
      getParam("gad_campaignid") ||
      getParam("gad_source")
    );
  }

  function currentEvidence() {
    var stored = readJson(STORAGE_KEY);
    var clickIdPresent = Boolean(getParam("gclid") || getParam("gbraid") || getParam("wbraid"));
    var googleUtmPresent = hasGoogleUtm();
    var incomingGoogleEvidence = hasIncomingGoogleEvidence(clickIdPresent, googleUtmPresent);
    var currentUrl = sanitizeUrl(location.href);
    var currentReferrer = sanitizeUrl(document.referrer || "");
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
      gad_campaignid: getParam("gad_campaignid") || stored.gad_campaignid || "",
      gad_source: getParam("gad_source") || stored.gad_source || "",
      utm_id: getParam("utm_id") || stored.utm_id || "",
      utm_source: getParam("utm_source") || stored.utm_source || "",
      utm_medium: getParam("utm_medium") || stored.utm_medium || "",
      utm_campaign: getParam("utm_campaign") || stored.utm_campaign || "",
      utm_term: getParam("utm_term") || stored.utm_term || "",
      utm_content: getParam("utm_content") || stored.utm_content || "",
      landing_url: incomingGoogleEvidence ? currentUrl : (stored.landing_url || currentUrl),
      current_url: currentUrl,
      referrer: incomingGoogleEvidence ? currentReferrer : (stored.referrer || currentReferrer),
      client_id: getClientId() || stored.client_id || "",
      ga_session_id: getGaSessionId() || stored.ga_session_id || "",
      local_session_id: stored.local_session_id || ("pciv1_" + Math.random().toString(36).slice(2)),
      captured_at: new Date().toISOString()
    };
    if (incomingGoogleEvidence) writeStored(evidence);
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

function summarizeTag(tag: any) {
  return {
    tagId: tag.tagId,
    name: tag.name,
    type: tag.type,
    fingerprint: tag.fingerprint,
    firingTriggerId: tag.firingTriggerId ?? [],
    blockingTriggerId: tag.blockingTriggerId ?? [],
    notes: tag.notes ?? "",
  };
}

async function main() {
  const token = await accessToken();
  const live = await gtmRequest<any>(token, `${BASE}/${CONTAINER_PATH}/versions:live`);
  const liveTags = live.tag ?? [];
  const liveTriggers = live.trigger ?? [];
  const liveTag = liveTags.find((tag: any) => String(tag.tagId) === TAG_ID);
  const liveTrigger = liveTriggers.find((trigger: any) => String(trigger.triggerId) === TRIGGER_ID);
  if (!liveTag) throw new Error(`live tag ${TAG_ID} not found`);
  if (!liveTrigger) throw new Error(`live trigger ${TRIGGER_ID} not found`);

  const oldHtml = getHtmlParam(liveTag);
  const newHtml = buildUpdatedHtml();
  const backupJsonPath = writeFile(
    `data/gtm-paid-click-intent-tag279-backup-${RUN_ID}.json`,
    `${JSON.stringify({
      generatedAt: new Date().toISOString(),
      mode: SHOULD_APPLY ? "apply_workspace_update" : "dry_run_backup_only",
      container: {
        accountId: ACCOUNT_ID,
        containerId: CONTAINER_ID,
        publicId: CONTAINER_PUBLIC_ID,
        liveVersionId: live.containerVersionId,
        liveVersionName: live.name,
        liveFingerprint: live.fingerprint,
      },
      liveTag,
      liveTrigger,
      oldHtmlSha256: sha256(oldHtml),
      newHtmlSha256: sha256(newHtml),
      noSubmitCreateVersionPublish: true,
      noPlatformSend: true,
    }, null, 2)}\n`,
  );
  const backupHtmlPath = writeFile(`data/gtm-paid-click-intent-tag279-backup-${RUN_ID}.html`, oldHtml);
  const updatedHtmlPath = writeFile(
    `data/gtm-paid-click-intent-tag279-${HTML_SOURCE_PATH ? "v3" : "v2"}-${RUN_ID}.html`,
    newHtml,
  );

  const result: Record<string, unknown> = {
    generatedAt: new Date().toISOString(),
    mode: SHOULD_APPLY ? "apply_workspace_update" : "dry_run_backup_only",
    backup: {
      jsonPath: backupJsonPath,
      htmlPath: backupHtmlPath,
      updatedHtmlPath,
      oldHtmlSha256: sha256(oldHtml),
      newHtmlSha256: sha256(newHtml),
    },
    container: {
      accountId: ACCOUNT_ID,
      containerId: CONTAINER_ID,
      publicId: CONTAINER_PUBLIC_ID,
      liveVersionId: live.containerVersionId,
      liveVersionName: live.name,
    },
    target: {
      tag: summarizeTag(liveTag),
      trigger: {
        triggerId: liveTrigger.triggerId,
        name: liveTrigger.name,
        type: liveTrigger.type,
        notes: liveTrigger.notes ?? "",
      },
    },
    invariants: {
      existingTagModifiedInFreshWorkspaceOnly: SHOULD_APPLY,
      triggerIdUnchanged: true,
      receiverUrlUnchanged: true,
      storageKeyUnchanged: true,
      sentKeyUnchanged: true,
      noSubmitCreateVersionPublish: true,
      noPlatformSend: true,
    },
  };

  if (!SHOULD_APPLY) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const workspace = await gtmRequest<any>(token, `${BASE}/${CONTAINER_PATH}/workspaces`, {
    method: "POST",
    body: {
      name: WORKSPACE_NAME,
      description: HTML_SOURCE_PATH
        ? "Codex Preview workspace: update existing tag 279 to v3 stale Google click id guard. No submit/create version/publish."
        : "Codex Preview workspace: update existing tag 279 to preserve gad_campaignid. No submit/create version/publish.",
    },
  });
  if (!workspace.path || !workspace.workspaceId) throw new Error("workspace path/workspaceId missing");

  const workspaceTag = await gtmRequest<any>(token, `${BASE}/${workspace.path}/tags/${TAG_ID}`);
  if (workspaceTag.name !== liveTag.name) {
    throw new Error(`workspace tag ${TAG_ID} unexpected name ${workspaceTag.name}`);
  }

  const updatedTag = {
    ...workspaceTag,
    notes: [
      workspaceTag.notes || "",
      HTML_SOURCE_PATH
        ? "2026-05-21 Codex Preview: v3 ignores stale stored Google click id types when current URL has a fresh Google click id. No conversion send."
        : "2026-05-21 Codex Preview: preserve gad_campaignid/gad_source in paid click evidence and refresh landing_url on new Google evidence. No conversion send.",
    ].filter(Boolean).join("\n"),
  };
  setHtmlParam(updatedTag, newHtml);

  const updateResponse = await gtmRequest<any>(token, `${BASE}/${workspace.path}/tags/${TAG_ID}`, {
    method: "PUT",
    headers: { "If-Match-Fingerprint": workspaceTag.fingerprint },
    body: updatedTag,
  });
  const status = await gtmRequest<any>(token, `${BASE}/${workspace.path}/status`);

  result.workspace = {
    workspaceId: workspace.workspaceId,
    name: workspace.name,
    path: workspace.path,
    fingerprint: workspace.fingerprint,
  };
  result.updatedTag = summarizeTag(updateResponse);
  result.workspaceStatus = {
    workspaceChangeCount: (status.workspaceChange ?? []).length,
    mergeConflictCount: (status.mergeConflict ?? []).length,
    changes: (status.workspaceChange ?? []).map((change: any) => ({
      changeStatus: change.changeStatus,
      tag: change.tag ? summarizeTag(change.tag) : null,
      trigger: change.trigger
        ? {
            triggerId: change.trigger.triggerId,
            name: change.trigger.name,
            type: change.trigger.type,
          }
        : null,
    })),
  };

  const resultPath = writeFile(
    `data/gtm-paid-click-intent-tag279-gad-campaignid-preview-update-${RUN_ID}.json`,
    `${JSON.stringify(result, null, 2)}\n`,
  );
  result.resultPath = resultPath;
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
