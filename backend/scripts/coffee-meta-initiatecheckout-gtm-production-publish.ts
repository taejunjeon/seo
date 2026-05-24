import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";
import { google } from "googleapis";

const REPO_ROOT = path.basename(process.cwd()) === "backend"
  ? path.resolve(process.cwd(), "..")
  : process.cwd();
const BACKEND_DIR = path.join(REPO_ROOT, "backend");

dotenv.config({ path: path.join(REPO_ROOT, ".env"), quiet: true });
dotenv.config({ path: path.join(BACKEND_DIR, ".env"), override: false, quiet: true });

const ACCOUNT_ID = "4703003246";
const CONTAINER_ID = "91608400";
const CONTAINER_PUBLIC_ID = "GTM-5M33GC4";
const CONTAINER_PATH = `accounts/${ACCOUNT_ID}/containers/${CONTAINER_ID}`;
const BASE = "https://tagmanager.googleapis.com/tagmanager/v2";
const RUN_ID = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "Z");
const OUTPUT_DIR = path.join(REPO_ROOT, "data", "project");

const WORKSPACE_NAME = `codex_coffee_meta_initiatecheckout_shop_payment_prod_${RUN_ID}`;
const TAG_NAME = "AGENTSOS - [Meta Browser] InitiateCheckout - shop_payment";
const TRIGGER_NAME = "AGENTSOS - [DOM Ready] shop_payment order only";
const args = new Set(process.argv.slice(2));
const SHOULD_UPDATE_EXISTING = args.has("--update-existing");
const VERSION_NAME = SHOULD_UPDATE_EXISTING
  ? `Coffee Meta InitiateCheckout shop_payment subscription guard - ${RUN_ID}`
  : `Coffee Meta InitiateCheckout shop_payment - ${RUN_ID}`;
const VERSION_NOTES = [
  "TJ approved Production publish in Codex chat.",
  "Scope: thecleancoffee.com /shop_payment/ order page only.",
  "Excludes /subscription/, payment complete pages, Purchase, Meta CAPI, GA4 MP, Google Ads, Naver, TikTok, DB writes.",
  "Adds a Meta browser InitiateCheckout call only when value and order hints are present.",
  SHOULD_UPDATE_EXISTING
    ? "Update mode: narrows existing tag with subscription checkout text guard."
    : "Create mode: creates one new tag and one new trigger.",
  "Rollback: restore previous live GTM version.",
].join("\n");

const EXPECTED_LIVE_VERSION_ID =
  process.env.COFFEE_META_INITIATECHECKOUT_EXPECTED_LIVE_VERSION?.trim() || "21";

const SHOULD_APPLY = args.has("--apply");
const SHOULD_PUBLISH = args.has("--publish");

if (SHOULD_PUBLISH && !SHOULD_APPLY) {
  throw new Error("--publish requires --apply");
}

type RequestOptions = {
  method?: string;
  body?: unknown;
};

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

const credentialsJson = () => {
  const raw = process.env.GA4_BIOCOM_SERVICE_ACCOUNT_KEY?.trim()
    || process.env.GSC_SERVICE_ACCOUNT_KEY?.trim()
    || process.env.GA4_SERVICE_ACCOUNT_KEY?.trim()
    || "";
  if (!raw) throw new Error("missing_google_service_account_env");
  return raw;
};

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(credentialsJson()),
  scopes: [
    "https://www.googleapis.com/auth/tagmanager.readonly",
    "https://www.googleapis.com/auth/tagmanager.edit.containers",
    "https://www.googleapis.com/auth/tagmanager.edit.containerversions",
    "https://www.googleapis.com/auth/tagmanager.publish",
    "https://www.googleapis.com/auth/tagmanager.delete.containers",
  ],
});

const accessToken = async () => {
  const client = await auth.getClient();
  const access = await client.getAccessToken();
  const token = typeof access === "string" ? access : access?.token;
  if (!token) throw new Error("failed_to_get_google_access_token");
  return token;
};

const gtmRequest = async <T>(token: string, url: string, options: RequestOptions = {}): Promise<T> => {
  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
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
};

const writeJson = (fileName: string, value: unknown) => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const outPath = path.join(OUTPUT_DIR, fileName);
  fs.writeFileSync(outPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return outPath;
};

const summarizeWorkspace = (workspace: any) => ({
  id: workspace.workspaceId,
  name: workspace.name,
  path: workspace.path,
});

const summarizeStatus = (status: any) => ({
  workspace_change_count: (status.workspaceChange ?? []).length,
  merge_conflict_count: (status.mergeConflict ?? []).length,
  changes: (status.workspaceChange ?? []).map((change: any) => ({
    change_status: change.changeStatus,
    tag: change.tag ? {
      tag_id: change.tag.tagId,
      name: change.tag.name,
      type: change.tag.type,
      firing_trigger_id: change.tag.firingTriggerId ?? [],
    } : null,
    trigger: change.trigger ? {
      trigger_id: change.trigger.triggerId,
      name: change.trigger.name,
      type: change.trigger.type,
    } : null,
  })),
  conflicts: (status.mergeConflict ?? []).map((conflict: any) => ({
    base_tag: conflict.entityInBaseVersion?.tag?.name ?? "",
    workspace_tag: conflict.entityInWorkspace?.tag?.name ?? "",
    base_trigger: conflict.entityInBaseVersion?.trigger?.name ?? "",
    workspace_trigger: conflict.entityInWorkspace?.trigger?.name ?? "",
  })),
});

const getHtmlParam = (tag: any) => {
  const htmlParam = (tag.parameter ?? []).find((param: any) => param.key === "html");
  return typeof htmlParam?.value === "string" ? htmlParam.value : "";
};

const buildTagHtml = () => `<script>
(function () {
  'use strict';

  var CONFIG = {
    snippetVersion: '2026-05-24-coffee-meta-initiatecheckout-shop-payment-v2-subscription-exclusion',
    pixelId: '1186437633687388',
    debugQueryKey: '__seo_attribution_debug',
    checkoutContextKey: '__seo_checkout_context',
    sentKeyPrefix: '__thecleancoffee_meta_initiatecheckout_sent__:',
    eventName: 'InitiateCheckout',
    logPrefix: '[coffee-meta-initiatecheckout-shop-payment]',
    fbqRetryMs: [0, 100, 250, 500, 1000, 2000, 3500, 5000],
    valueSelectors: [
      '[data-payment-total]',
      '[data-order-total]',
      '[data-total-price]',
      '._payment_total_price',
      '.total_price',
      '._cart_main_total_price',
      '.im-price-result',
      '.im-order-price',
      '.shop-table > tfoot .payment-info',
      '.payment-total',
      '.order-total',
      '.total-price',
      '.pay_total .price',
      '.order_price .price'
    ]
  };

  if (window.__THECLEANCOFFEE_META_INITIATECHECKOUT_SHOP_PAYMENT__ === CONFIG.snippetVersion) return;
  window.__THECLEANCOFFEE_META_INITIATECHECKOUT_SHOP_PAYMENT__ = CONFIG.snippetVersion;

  function trim(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  }

  function safeParse(raw) {
    if (!raw) return {};
    try {
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  function readSessionJson(key) {
    try {
      return safeParse(window.sessionStorage && window.sessionStorage.getItem(key));
    } catch (error) {
      return {};
    }
  }

  function readSessionText(key) {
    try {
      return trim(window.sessionStorage && window.sessionStorage.getItem(key));
    } catch (error) {
      return '';
    }
  }

  function writeSessionText(key, value) {
    try {
      if (!window.sessionStorage) return false;
      window.sessionStorage.setItem(key, value);
      return true;
    } catch (error) {
      return false;
    }
  }

  function firstNonEmpty(values) {
    for (var i = 0; i < values.length; i += 1) {
      var value = trim(values[i]);
      if (value) return value;
    }
    return '';
  }

  function normalizeText(value) {
    return trim(value).replace(/\\s+/g, ' ');
  }

  function isDebugMode() {
    try {
      return new URLSearchParams(window.location.search).get(CONFIG.debugQueryKey) === '1';
    } catch (error) {
      return false;
    }
  }

  function debugLog(label, fields) {
    if (!isDebugMode()) return;
    try {
      console.info(CONFIG.logPrefix, label, fields || {});
    } catch (error) {}
  }

  function getSearchParam(keys) {
    try {
      var params = new URLSearchParams(window.location.search);
      for (var i = 0; i < keys.length; i += 1) {
        var value = trim(params.get(keys[i]));
        if (value) return value;
      }
    } catch (error) {}
    return '';
  }

  function isShopPaymentPage() {
    var path = trim(window.location.pathname).toLowerCase();
    return path === '/shop_payment' || path === '/shop_payment/';
  }

  function isSubscriptionCheckout() {
    var root = null;
    try {
      root = document.querySelector('#oms-shop-payment');
    } catch (error) {
      root = null;
    }
    if (!root) return false;

    var text = normalizeText(root.innerText || root.textContent || '');
    return text.indexOf('[더클린 정기구독]') >= 0 ||
      text.indexOf('정기구독 신청') >= 0 ||
      text.indexOf('subscription') >= 0;
  }

  function stableHash(value) {
    var text = trim(value);
    var hash = 2166136261;
    for (var i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return ('00000000' + (hash >>> 0).toString(16)).slice(-8);
  }

  function getOrderHints() {
    var checkoutContext = readSessionJson(CONFIG.checkoutContextKey);
    return {
      orderCode: firstNonEmpty([
        getSearchParam(['order_code', 'orderCode']),
        checkoutContext.orderCode,
        checkoutContext.order_code
      ]),
      orderNo: firstNonEmpty([
        getSearchParam(['order_no', 'orderNo']),
        checkoutContext.orderNo,
        checkoutContext.order_no
      ]),
      orderMember: firstNonEmpty([
        getSearchParam(['order_member', 'orderMember']),
        checkoutContext.orderMember,
        checkoutContext.order_member
      ]),
      checkoutId: firstNonEmpty([
        checkoutContext.checkoutId,
        checkoutContext.checkout_id,
        getSearchParam(['checkoutId', 'checkout_id'])
      ])
    };
  }

  function hasOrderHint(hints) {
    return Boolean(hints.orderCode || hints.orderNo || hints.checkoutId);
  }

  function parsePriceFromText(raw) {
    var text = trim(raw).replace(/,/g, '');
    if (!text) return null;
    var matches = text.match(/[0-9]+(?:\\.[0-9]+)?/g);
    if (!matches || !matches.length) return null;
    var best = 0;
    for (var i = 0; i < matches.length; i += 1) {
      var value = Number(matches[i]);
      if (Number.isFinite(value) && value > best) best = value;
    }
    return best > 0 ? best : null;
  }

  function parsePriceAfterLabel(raw, label) {
    var text = trim(raw).replace(/\\s+/g, ' ');
    var index = text.indexOf(label);
    if (index < 0) return null;
    var rest = text.slice(index + label.length);
    var wonMatch = rest.match(/([0-9][0-9,]*(?:\\.[0-9]+)?)\\s*원/);
    if (wonMatch && wonMatch[1]) {
      var wonValue = Number(wonMatch[1].replace(/,/g, ''));
      if (Number.isFinite(wonValue) && wonValue > 0) return wonValue;
    }
    return parsePriceFromText(rest);
  }

  function isVisible(node) {
    try {
      if (!node) return false;
      var style = window.getComputedStyle ? window.getComputedStyle(node) : null;
      if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
      var rect = node.getBoundingClientRect ? node.getBoundingClientRect() : null;
      return !rect || (rect.width > 0 && rect.height > 0);
    } catch (error) {
      return true;
    }
  }

  function readOrderSummaryValue() {
    var selectors = ['#oms-shop-payment', 'main', 'body'];
    for (var i = 0; i < selectors.length; i += 1) {
      var node = null;
      try {
        node = document.querySelector(selectors[i]);
      } catch (error) {
        node = null;
      }
      if (!node) continue;
      var text = node.innerText || node.textContent || '';
      if (text.indexOf('주문 요약') < 0 || text.indexOf('총 주문금액') < 0) continue;
      var value = parsePriceAfterLabel(text, '총 주문금액');
      if (value) {
        return {
          value: value,
          valueStatus: 'present',
          selector: selectors[i] + ' text:total_order_price'
        };
      }
    }
    return null;
  }

  function readValueCandidate() {
    var orderSummaryValue = readOrderSummaryValue();
    if (orderSummaryValue) return orderSummaryValue;

    for (var i = 0; i < CONFIG.valueSelectors.length; i += 1) {
      var selector = CONFIG.valueSelectors[i];
      var nodes = [];
      try {
        nodes = Array.prototype.slice.call(document.querySelectorAll(selector));
      } catch (error) {
        nodes = [];
      }
      for (var j = 0; j < nodes.length; j += 1) {
        if (!isVisible(nodes[j])) continue;
        var value = parsePriceFromText(nodes[j].getAttribute('data-payment-total') ||
          nodes[j].getAttribute('data-order-total') ||
          nodes[j].getAttribute('data-total-price') ||
          nodes[j].textContent);
        if (value) {
          return { value: value, valueStatus: 'present', selector: selector };
        }
      }
    }
    return { value: null, valueStatus: 'missing', selector: '' };
  }

  function buildEventId(hints) {
    var basis = firstNonEmpty([
      hints.checkoutId,
      hints.orderCode,
      hints.orderNo,
      window.location.pathname + '|' + window.location.search
    ]);
    return CONFIG.eventName + '.' + stableHash('thecleancoffee|' + basis);
  }

  function rememberStatus(status, fields) {
    var payload = fields || {};
    payload.status = status;
    payload.snippetVersion = CONFIG.snippetVersion;
    payload.updatedAt = new Date().toISOString();
    try {
      window.__THECLEANCOFFEE_META_INITIATECHECKOUT_LAST__ = payload;
    } catch (error) {}
    debugLog(status, payload);
  }

  function buildCustomData(valueResult, hints) {
    return {
      value: Number(valueResult.value),
      currency: 'KRW',
      content_type: 'product',
      order_code_present: Boolean(hints.orderCode),
      order_no_present: Boolean(hints.orderNo),
      checkout_id_present: Boolean(hints.checkoutId),
      value_status: valueResult.valueStatus,
      value_selector: valueResult.selector,
      snippet_version: CONFIG.snippetVersion
    };
  }

  function runWithFbq(callback) {
    var done = false;
    CONFIG.fbqRetryMs.forEach(function (delayMs, index) {
      window.setTimeout(function () {
        if (done) return;
        if (typeof window.fbq === 'function') {
          done = true;
          callback(window.fbq);
          return;
        }
        if (index === CONFIG.fbqRetryMs.length - 1) {
          done = true;
          callback(null);
        }
      }, delayMs);
    });
  }

  function run() {
    if (!isShopPaymentPage()) {
      rememberStatus('blocked', { reason: 'not_shop_payment_page', path: window.location.pathname });
      return;
    }

    if (isSubscriptionCheckout()) {
      rememberStatus('blocked', { reason: 'subscription_checkout_excluded' });
      return;
    }

    var hints = getOrderHints();
    if (!hasOrderHint(hints)) {
      rememberStatus('blocked', { reason: 'missing_order_hint' });
      return;
    }

    var valueResult = readValueCandidate();
    if (!valueResult.value) {
      rememberStatus('blocked', { reason: 'missing_value', valueStatus: valueResult.valueStatus });
      return;
    }

    var eventId = buildEventId(hints);
    var sentKey = CONFIG.sentKeyPrefix + eventId;
    if (readSessionText(sentKey)) {
      rememberStatus('blocked', { reason: 'deduped', eventID: eventId });
      return;
    }

    runWithFbq(function (fbq) {
      if (typeof fbq !== 'function') {
        rememberStatus('blocked', { reason: 'fbq_unavailable', eventID: eventId });
        return;
      }
      var customData = buildCustomData(valueResult, hints);
      try {
        fbq('track', CONFIG.eventName, customData, { eventID: eventId });
        writeSessionText(sentKey, new Date().toISOString());
        rememberStatus('sent', {
          eventName: CONFIG.eventName,
          eventID: eventId,
          value: customData.value,
          currency: customData.currency,
          valueSelector: valueResult.selector
        });
      } catch (error) {
        rememberStatus('blocked', {
          reason: 'fbq_throw',
          eventID: eventId,
          message: error && error.message ? error.message : String(error)
        });
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }
})();
</script>`;

const triggerBody = () => ({
  name: TRIGGER_NAME,
  type: "domReady",
  filter: [
    {
      type: "equals",
      parameter: [
        { type: "template", key: "arg0", value: "{{Page Hostname}}" },
        { type: "template", key: "arg1", value: "thecleancoffee.com" },
      ],
    },
    {
      type: "matchRegex",
      parameter: [
        { type: "template", key: "arg0", value: "{{Page URL}}" },
        { type: "template", key: "arg1", value: "\\/shop_payment\\/?\\?.*(order_code|order_no|orderCode|orderNo)=" },
        { type: "boolean", key: "ignore_case", value: "true" },
      ],
    },
    {
      type: "equals",
      parameter: [
        { type: "template", key: "arg0", value: "{{HURDLERS - Iframe}}" },
        { type: "template", key: "arg1", value: "false" },
      ],
    },
  ],
  notes: "Coffee Meta InitiateCheckout production trigger. /shop_payment/ order pages only.",
});

const tagBody = (triggerId: string) => ({
  name: TAG_NAME,
  type: "html",
  parameter: [
    { type: "template", key: "html", value: buildTagHtml() },
    { type: "boolean", key: "supportDocumentWrite", value: "false" },
  ],
  firingTriggerId: [triggerId],
  notes:
    "TJ approved. Sends Meta browser InitiateCheckout only on Coffee /shop_payment/ when order hints and value are present. No Purchase, no Meta CAPI, no GA4/Google Ads/Naver/TikTok send, no DB write.",
});

const tagHasDuplicateIntent = (tag: any) => {
  const html = getHtmlParam(tag);
  return tag.name === TAG_NAME
    || html.includes("2026-05-24-coffee-meta-initiatecheckout-shop-payment-v1")
    || html.includes("2026-05-24-coffee-meta-initiatecheckout-shop-payment-v2-subscription-exclusion");
};

const validatePrePublish = (params: {
  liveBefore: any;
  status: any;
  quickPreview: any;
  tag: any;
  trigger: any;
  expectedChangeCount: number;
}) => {
  const problems: string[] = [];
  const statusSummary = summarizeStatus(params.status);
  const changes = params.status.workspaceChange ?? [];
  const conflicts = params.status.mergeConflict ?? [];
  const changeNames = changes.map((change: any) => change.tag?.name || change.trigger?.name || "");
  const html = getHtmlParam(params.tag);

  if (String(params.liveBefore.containerVersionId) !== EXPECTED_LIVE_VERSION_ID) {
    problems.push(`live version ${params.liveBefore.containerVersionId}, expected ${EXPECTED_LIVE_VERSION_ID}`);
  }
  if (changes.length !== params.expectedChangeCount) {
    problems.push(`workspaceChange count ${changes.length}, expected ${params.expectedChangeCount}`);
  }
  if (conflicts.length !== 0) problems.push(`mergeConflict count ${conflicts.length}, expected 0`);
  if (!changeNames.includes(TAG_NAME)) problems.push(`workspace changes missing tag ${TAG_NAME}`);
  if (!SHOULD_UPDATE_EXISTING && !changeNames.includes(TRIGGER_NAME)) {
    problems.push(`workspace changes missing trigger ${TRIGGER_NAME}`);
  }
  if (params.quickPreview.compilerError) problems.push("quick_preview compilerError=true");
  if (params.tag.name !== TAG_NAME) problems.push(`tag name ${params.tag.name}, expected ${TAG_NAME}`);
  if (params.trigger.name !== TRIGGER_NAME) problems.push(`trigger name ${params.trigger.name}, expected ${TRIGGER_NAME}`);
  if (!html.includes("fbq('track', CONFIG.eventName")) problems.push("tag html missing fbq track call");
  if (!html.includes("2026-05-24-coffee-meta-initiatecheckout-shop-payment-v2-subscription-exclusion")) {
    problems.push("tag html missing snippet version");
  }
  if (html.includes("facebook.com/tr")) problems.push("tag html should not use image fallback");
  if (html.includes("fetch(") || html.includes("sendBeacon")) problems.push("tag html should not use fetch/sendBeacon");
  if (!html.includes("isShopPaymentPage")) problems.push("tag html missing shop payment guard");
  if (!html.includes("subscription_checkout_excluded")) problems.push("tag html missing subscription checkout guard");
  if (!html.includes("missing_value")) problems.push("tag html missing value guard");

  return {
    ok: problems.length === 0,
    problems,
    status_summary: statusSummary,
  };
};

const main = async () => {
  const token = await accessToken();
  const gtm = google.tagmanager({ version: "v2", auth });

  const liveBefore = await gtmRequest<any>(token, `${BASE}/${CONTAINER_PATH}/versions:live`);
  const workspacesBefore = await gtm.accounts.containers.workspaces.list({ parent: CONTAINER_PATH });
  const liveTags = liveBefore.tag ?? [];
  const duplicateLiveTags = liveTags.filter(tagHasDuplicateIntent);
  const defaultWorkspace = (workspacesBefore.data.workspace ?? [])
    .find((workspace) => /default workspace/i.test(workspace.name ?? ""));
  const defaultStatus = defaultWorkspace?.path
    ? await gtm.accounts.containers.workspaces.getStatus({ path: defaultWorkspace.path }).catch((error: unknown) => ({
      data: { error: error instanceof Error ? error.message : String(error) },
    }))
    : null;

  const preflight = {
    generated_at_kst: kstTimestamp(),
    run_id: RUN_ID,
    mode: SHOULD_APPLY ? (SHOULD_PUBLISH ? "apply_publish" : "apply_preview_only") : "dry_run",
    approval: {
      approved_by: "TJ",
      approved_scope: "Coffee GTM-5M33GC4 /shop_payment/ Meta browser InitiateCheckout fresh workspace Preview then Production publish",
    },
    container: {
      account_id: ACCOUNT_ID,
      container_id: CONTAINER_ID,
      public_id: CONTAINER_PUBLIC_ID,
      path: CONTAINER_PATH,
    },
    live_before: {
      container_version_id: liveBefore.containerVersionId,
      name: liveBefore.name,
    },
    expected_live_version_id: EXPECTED_LIVE_VERSION_ID,
    workspace_before_count: (workspacesBefore.data.workspace ?? []).length,
    workspaces_before: (workspacesBefore.data.workspace ?? []).map(summarizeWorkspace),
    default_workspace_status: defaultStatus ? summarizeStatus(defaultStatus.data) : null,
    duplicate_live_tag_count: duplicateLiveTags.length,
    planned: {
      workspace_name: WORKSPACE_NAME,
      tag_name: TAG_NAME,
      trigger_name: TRIGGER_NAME,
      version_name: VERSION_NAME,
      excludes_subscription: true,
      update_existing: SHOULD_UPDATE_EXISTING,
      excludes_complete_pages: true,
      no_purchase: true,
      no_meta_capi_enable: true,
      no_ga4_mp: true,
      no_google_ads: true,
      no_naver_tiktok: true,
      no_db_write: true,
    },
  };

  if (duplicateLiveTags.length > 0 && !SHOULD_UPDATE_EXISTING) {
    throw new Error(`duplicate live tag exists: ${duplicateLiveTags.map((tag: any) => tag.name).join(", ")}`);
  }
  if (SHOULD_UPDATE_EXISTING && duplicateLiveTags.length !== 1) {
    throw new Error(`update mode expected exactly one live target tag, found ${duplicateLiveTags.length}`);
  }

  if (!SHOULD_APPLY) {
    const outputPath = writeJson(`coffee-meta-initiatecheckout-gtm-production-dry-run-${RUN_ID}.json`, preflight);
    writeJson("coffee-meta-initiatecheckout-gtm-production-dry-run-latest.json", preflight);
    console.log(JSON.stringify({
      verdict: String(liveBefore.containerVersionId) === EXPECTED_LIVE_VERSION_ID
        ? "PASS_DRY_RUN_READY"
        : "HOLD_LIVE_VERSION_MISMATCH",
      output: outputPath,
      live_before: preflight.live_before,
      workspace_before_count: preflight.workspace_before_count,
      duplicate_live_tag_count: preflight.duplicate_live_tag_count,
      default_workspace_status: preflight.default_workspace_status,
    }, null, 2));
    return;
  }

  let workspacePath = "";
  let published = false;

  try {
    if (String(liveBefore.containerVersionId) !== EXPECTED_LIVE_VERSION_ID) {
      throw new Error(`live_version_mismatch_${liveBefore.containerVersionId}_expected_${EXPECTED_LIVE_VERSION_ID}`);
    }

    const workspace = await gtm.accounts.containers.workspaces.create({
      parent: CONTAINER_PATH,
      requestBody: {
        name: WORKSPACE_NAME,
        description:
          "Codex Coffee Meta InitiateCheckout /shop_payment/ production workspace. TJ approved Production publish.",
      },
    });
    if (!workspace.data.path || !workspace.data.workspaceId) {
      throw new Error("workspace_create_missing_path_or_id");
    }
    workspacePath = workspace.data.path;

    let trigger: any = null;
    let tag: any = null;

    if (SHOULD_UPDATE_EXISTING) {
      const liveTargetTag = duplicateLiveTags[0];
      const existingTriggerId = String((liveTargetTag.firingTriggerId ?? [])[0] ?? "");
      if (!existingTriggerId) throw new Error("update_mode_missing_existing_trigger_id");
      const liveTrigger = (liveBefore.trigger ?? [])
        .find((item: any) => String(item.triggerId) === existingTriggerId);
      if (!liveTrigger) throw new Error(`update_mode_live_trigger_${existingTriggerId}_not_found`);
      trigger = { data: liveTrigger };
      tag = await gtm.accounts.containers.workspaces.tags.update({
        path: `${workspacePath}/tags/${liveTargetTag.tagId}`,
        requestBody: tagBody(existingTriggerId),
      });
    } else {
      trigger = await gtm.accounts.containers.workspaces.triggers.create({
        parent: workspacePath,
        requestBody: triggerBody(),
      });
      if (!trigger.data.triggerId) throw new Error("trigger_create_missing_id");

      tag = await gtm.accounts.containers.workspaces.tags.create({
        parent: workspacePath,
        requestBody: tagBody(trigger.data.triggerId),
      });
    }
    if (!tag.data.tagId) throw new Error("tag_create_missing_id");

    const quickPreview = await gtm.accounts.containers.workspaces.quick_preview({ path: workspacePath });
    const status = await gtm.accounts.containers.workspaces.getStatus({ path: workspacePath });
    const prePublish = validatePrePublish({
      liveBefore,
      status: status.data,
      quickPreview: quickPreview.data,
      tag: tag.data,
      trigger: trigger.data,
      expectedChangeCount: SHOULD_UPDATE_EXISTING ? 1 : 2,
    });

    const prePublishBackup = {
      ...preflight,
      workspace: {
        workspace_id: workspace.data.workspaceId,
        name: workspace.data.name,
        path: workspace.data.path,
      },
      trigger: {
        trigger_id: trigger.data.triggerId,
        name: trigger.data.name,
        type: trigger.data.type,
      },
      tag: {
        tag_id: tag.data.tagId,
        name: tag.data.name,
        type: tag.data.type,
        firing_trigger_id: tag.data.firingTriggerId,
        update_existing: SHOULD_UPDATE_EXISTING,
      },
      quick_preview: {
        compiler_error: quickPreview.data.compilerError ?? false,
        sync_status: quickPreview.data.syncStatus ?? null,
      },
      workspace_status: prePublish.status_summary,
      pre_publish: prePublish,
      tag_backup: tag.data,
      trigger_backup: trigger.data,
    };
    const prePublishBackupPath = writeJson(
      `coffee-meta-initiatecheckout-gtm-production-prepublish-backup-${RUN_ID}.json`,
      prePublishBackup,
    );

    if (!prePublish.ok) {
      throw new Error(`pre_publish_validation_failed: ${prePublish.problems.join("; ")}`);
    }

    const versionResponse = await gtmRequest<any>(token, `${BASE}/${workspacePath}:create_version`, {
      method: "POST",
      body: {
        name: VERSION_NAME,
        notes: VERSION_NOTES,
      },
    });
    if (versionResponse.compilerError) {
      throw new Error("create_version_compiler_error");
    }
    const createdVersion = versionResponse.containerVersion;
    if (!createdVersion?.path || !createdVersion.containerVersionId) {
      throw new Error("created_version_missing_path_or_id");
    }

    const publishResponse = await gtmRequest<any>(token, `${BASE}/${createdVersion.path}:publish`, {
      method: "POST",
    });
    if (publishResponse.compilerError) {
      throw new Error("publish_compiler_error");
    }
    published = true;

    const liveAfter = await gtmRequest<any>(token, `${BASE}/${CONTAINER_PATH}/versions:live`);
    const workspacesAfter = await gtm.accounts.containers.workspaces.list({ parent: CONTAINER_PATH });
    const liveAfterTags = liveAfter.tag ?? [];
    const livePublishedTags = liveAfterTags.filter(tagHasDuplicateIntent);
    const targetWorkspaceAfter = (workspacesAfter.data.workspace ?? [])
      .find((item) => item.workspaceId === workspace.data.workspaceId);

    const result = {
      ...preflight,
      mode: "apply_publish",
      prepublish_backup_path: prePublishBackupPath,
      workspace: {
        workspace_id: workspace.data.workspaceId,
        name: workspace.data.name,
        path: workspace.data.path,
        present_after_publish: Boolean(targetWorkspaceAfter),
      },
      trigger: {
        trigger_id: trigger.data.triggerId,
        name: trigger.data.name,
        type: trigger.data.type,
      },
      tag: {
        tag_id: tag.data.tagId,
        name: tag.data.name,
        type: tag.data.type,
        firing_trigger_id: tag.data.firingTriggerId,
      },
      quick_preview: {
        compiler_error: quickPreview.data.compilerError ?? false,
        sync_status: quickPreview.data.syncStatus ?? null,
      },
      workspace_status: prePublish.status_summary,
      created_version: {
        container_version_id: createdVersion.containerVersionId,
        name: createdVersion.name,
        path: createdVersion.path,
        compiler_error: versionResponse.compilerError ?? false,
      },
      publish: {
        compiler_error: publishResponse.compilerError ?? false,
      },
      live_after: {
        container_version_id: liveAfter.containerVersionId,
        name: liveAfter.name,
        matches_created_version: liveAfter.containerVersionId === createdVersion.containerVersionId,
      },
      workspace_after_count: (workspacesAfter.data.workspace ?? []).length,
      workspaces_after: (workspacesAfter.data.workspace ?? []).map(summarizeWorkspace),
      live_published_matching_tag_count: livePublishedTags.length,
      invariants: {
        fresh_workspace_used: true,
        default_workspace_used: false,
        quick_preview_before_publish: true,
        only_expected_changes_published: prePublish.status_summary.workspace_change_count === (SHOULD_UPDATE_EXISTING ? 1 : 2),
        no_merge_conflict: prePublish.status_summary.merge_conflict_count === 0,
        live_version_advanced: liveAfter.containerVersionId !== liveBefore.containerVersionId,
        live_matches_created_version: liveAfter.containerVersionId === createdVersion.containerVersionId,
        no_purchase: true,
        no_meta_capi_enable: true,
        no_ga4_mp: true,
        no_google_ads: true,
        no_naver_tiktok: true,
        no_db_write: true,
      },
      verdict:
        liveAfter.containerVersionId === createdVersion.containerVersionId
        && livePublishedTags.length === 1
        && !quickPreview.data.compilerError
          ? "PASS_PRODUCTION_PUBLISH"
          : "HOLD_PRODUCTION_PUBLISH_VERIFICATION",
    };

    const outputPath = writeJson(`coffee-meta-initiatecheckout-gtm-production-publish-${RUN_ID}.json`, result);
    const latestOutputPath = writeJson("coffee-meta-initiatecheckout-gtm-production-publish-latest.json", result);
    console.log(JSON.stringify({
      verdict: result.verdict,
      live_before: result.live_before,
      live_after: result.live_after,
      workspace: result.workspace,
      tag: result.tag,
      trigger: result.trigger,
      quick_preview: result.quick_preview,
      created_version: result.created_version,
      live_published_matching_tag_count: result.live_published_matching_tag_count,
      output: outputPath,
      latest_output: latestOutputPath,
      prepublish_backup: prePublishBackupPath,
    }, null, 2));
  } catch (error) {
    if (workspacePath && !published) {
      await gtm.accounts.containers.workspaces.delete({ path: workspacePath }).catch(() => undefined);
    }
    throw error;
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
