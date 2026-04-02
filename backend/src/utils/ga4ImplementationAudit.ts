export type AuditLineHit = {
  line: number;
  text: string;
};

export type Ga4ImplementationRisk = {
  location: string;
  codeType: string;
  identifier: string;
  risk: "high" | "medium" | "low";
  why: string;
  fixability: "yes" | "partial" | "no";
};

export type LiveGa4HtmlAudit = {
  measurementIds: string[];
  gtmContainerIds: string[];
  adIds: string[];
  activeEvents: string[];
  commentedEvents: string[];
  flags: {
    hasDirectGtag: boolean;
    hasMultipleGtmContainers: boolean;
    hasUserIdSetter: boolean;
    utmPersistenceRequiresUserId: boolean;
    utmStoresZeroStringFallback: boolean;
    hasRebuyzViewEvent: boolean;
    hasStandardViewItemEvent: boolean;
    hasCommentedOutViewItem: boolean;
    sendPageViewExplicitlyDisabled: boolean;
    hasCrossDomainHintInHtml: boolean;
  };
  evidence: {
    directGtag: AuditLineHit[];
    gtmSnippets: AuditLineHit[];
    userIdSetter: AuditLineHit[];
    utmPersistence: AuditLineHit[];
    utmZeroFallback: AuditLineHit[];
    rebuyzView: AuditLineHit[];
    viewItemActive: AuditLineHit[];
    viewItemCommented: AuditLineHit[];
    linkerOrCrossDomain: AuditLineHit[];
  };
};

const collectUniqueMatches = (html: string, regex: RegExp): string[] => {
  const values = new Set<string>();
  for (const match of html.matchAll(regex)) {
    const value = match[1];
    if (value) values.add(value);
  }
  return [...values].sort();
};

const findLineHits = (html: string, regex: RegExp): AuditLineHit[] =>
  html
    .split(/\r?\n/)
    .map((text, idx) => ({ line: idx + 1, text }))
    .filter(({ text }) => regex.test(text))
    .map(({ line, text }) => ({ line, text: text.trim() }));

const hasActiveGtagEvent = (html: string, eventName: string) =>
  findLineHits(
    html,
    new RegExp(String.raw`^\s*gtag\('event',\s*'${eventName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}'`),
  ).length > 0;

const hasCommentedOutGtagEvent = (html: string, eventName: string) =>
  findLineHits(
    html,
    new RegExp(String.raw`^\s*\/\/\s*gtag\('event',\s*'${eventName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}'`),
  ).length > 0;

export const auditLiveGa4Html = (html: string): LiveGa4HtmlAudit => {
  const measurementIds = collectUniqueMatches(html, /\b(G-[A-Z0-9]+)\b/g);
  const gtmContainerIds = collectUniqueMatches(html, /\b(GTM-[A-Z0-9]+)\b/g);
  const adIds = collectUniqueMatches(html, /\b(AW-[0-9]+)\b/g);

  const directGtag = findLineHits(html, /gtag\/js\?id=G-[A-Z0-9]+|gtag\('config',\s*'G-[A-Z0-9]+'/);
  const gtmSnippets = findLineHits(html, /googletagmanager\.com\/gtm\.js\?id=GTM-|ns\.html\?id=GTM-/);
  const userIdSetter = findLineHits(html, /gtag\('set',\s*\{\s*user_id:/);
  const utmPersistence = findLineHits(html, /localStorage\.setItem\('rebuyz_utm'|if\s*\(userID\)\s*\{/);
  const utmZeroFallback = findLineHits(html, /params\.get\('utm_(campaign|source|medium|content)'\)\s*\|\|\s*'0'/);
  const rebuyzView = findLineHits(html, /gtag\('event',\s*'rebuyz_view'/);
  const viewItemActive = findLineHits(html, /^\s*gtag\('event',\s*'view_item'/);
  const viewItemCommented = findLineHits(html, /^\s*\/\/\s*gtag\('event',\s*'view_item'/);
  const linkerOrCrossDomain = findLineHits(html, /send_page_view|allow_linker|cross_domain|_gl=|linker/);

  const activeEvents = ["view_item", "rebuyz_view", "add_to_cart", "begin_checkout", "add_payment_info", "purchase"]
    .filter((eventName) => hasActiveGtagEvent(html, eventName));
  const commentedEvents = ["view_item", "rebuyz_view", "add_to_cart", "begin_checkout", "add_payment_info", "purchase"]
    .filter((eventName) => hasCommentedOutGtagEvent(html, eventName));

  return {
    measurementIds,
    gtmContainerIds,
    adIds,
    activeEvents,
    commentedEvents,
    flags: {
      hasDirectGtag: directGtag.length > 0,
      hasMultipleGtmContainers: gtmContainerIds.length >= 2,
      hasUserIdSetter: userIdSetter.length > 0,
      utmPersistenceRequiresUserId: /persistUtm[\s\S]{0,1200}if\s*\(userID\)\s*\{[\s\S]{0,1200}localStorage\.setItem\('rebuyz_utm'/.test(
        html,
      ),
      utmStoresZeroStringFallback: utmZeroFallback.length > 0,
      hasRebuyzViewEvent: rebuyzView.length > 0,
      hasStandardViewItemEvent: viewItemActive.length > 0,
      hasCommentedOutViewItem: viewItemCommented.length > 0,
      sendPageViewExplicitlyDisabled: /gtag\('config',\s*'G-[A-Z0-9]+'\s*,\s*\{[^}]*send_page_view\s*:\s*false/.test(html),
      hasCrossDomainHintInHtml: linkerOrCrossDomain.length > 0,
    },
    evidence: {
      directGtag,
      gtmSnippets,
      userIdSetter,
      utmPersistence,
      utmZeroFallback,
      rebuyzView,
      viewItemActive,
      viewItemCommented,
      linkerOrCrossDomain,
    },
  };
};

export const buildLiveGa4RiskRows = (audit: LiveGa4HtmlAudit): Ga4ImplementationRisk[] => {
  const rows: Ga4ImplementationRisk[] = [];

  if (audit.flags.hasDirectGtag) {
    rows.push({
      location: "live HTML <head>",
      codeType: "direct gtag",
      identifier: audit.measurementIds.join(", ") || "unknown",
      risk: audit.flags.hasMultipleGtmContainers ? "high" : "medium",
      why:
        audit.flags.hasMultipleGtmContainers
          ? "direct gtag와 GTM 컨테이너가 함께 있으면 page_view와 ecommerce 이벤트가 이중 발화될 여지가 생긴다."
          : "direct gtag가 단독 삽입돼 있으면 GTM 기준 추적 체계와 분기될 수 있다.",
      fixability: "yes",
    });
  }

  for (const containerId of audit.gtmContainerIds) {
    rows.push({
      location: "live HTML <head>/<body>",
      codeType: "GTM snippet",
      identifier: containerId,
      risk: audit.flags.hasMultipleGtmContainers ? "high" : "medium",
      why:
        audit.flags.hasMultipleGtmContainers
          ? "GTM 컨테이너가 2개면 같은 페이지에서 같은 이벤트를 다른 규칙으로 중복 발화시킬 위험이 커진다."
          : "GTM 내부 태그 구성을 코드만으로는 볼 수 없어 추적 책임 경계가 불명확하다.",
      fixability: "partial",
    });
  }

  if (audit.flags.hasUserIdSetter) {
    rows.push({
      location: "live HTML custom script",
      codeType: "custom event / identity",
      identifier: "gtag set user_id",
      risk: "medium",
      why: "로그인 식별 타이밍과 GA4 초기 page_view 타이밍이 어긋나면 session attribution과 user attribution이 갈라질 수 있다.",
      fixability: "yes",
    });
  }

  if (audit.flags.utmPersistenceRequiresUserId || audit.flags.utmStoresZeroStringFallback) {
    rows.push({
      location: "live HTML custom script",
      codeType: "UTM persistence",
      identifier: "rebuyz_utm",
      risk: "high",
      why:
        audit.flags.utmPersistenceRequiresUserId && audit.flags.utmStoresZeroStringFallback
          ? "비로그인 첫 방문은 UTM 저장이 안 되고, 값이 없을 때 '0' 문자열을 저장해 source/medium 오염까지 만들 수 있다."
          : audit.flags.utmPersistenceRequiresUserId
            ? "비로그인 첫 방문 UTM이 저장되지 않으면 첫 방문 attribution이 쉽게 사라진다."
            : "없는 값을 '0' 문자열로 저장하면 유입원 집계가 실제 null이 아니라 가짜 source 값으로 남을 수 있다.",
      fixability: "yes",
    });
  }

  if (audit.flags.hasRebuyzViewEvent || audit.flags.hasCommentedOutViewItem) {
    rows.push({
      location: "live HTML custom script",
      codeType: "custom event / ecommerce",
      identifier: audit.flags.hasRebuyzViewEvent ? "rebuyz_view" : "view_item",
      risk: "high",
      why:
        audit.flags.hasRebuyzViewEvent && audit.flags.hasCommentedOutViewItem
          ? "표준 view_item은 주석 처리돼 있고 rebuyz_view만 발화되면 ecommerce 보고서와 퍼널이 비어 보일 수 있다."
          : "표준 ecommerce 이벤트 체계와 다른 이름을 쓰면 GA4 기본 보고서와 분리된다.",
      fixability: "yes",
    });
  }

  return rows;
};
