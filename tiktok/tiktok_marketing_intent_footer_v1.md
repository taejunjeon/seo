# TikTok Marketing Intent Footer v1

작성 시각: 2026-05-02 19:10 KST
상태: 운영 붙여넣기 후보. 아직 아임웹 반영 전. 2026-05-02 검토 결과, 우선순위는 GTM 방식(`tiktok/tiktok_marketing_intent_gtm_v1.md`)이 더 높다.
저장 대상: TJ 관리 Attribution VM SQLite `CRM_LOCAL_DB_PATH#attribution_ledger`
엔드포인트: `https://att.ainativeos.net/api/attribution/marketing-intent`

## 목적

TikTok 광고 클릭이 결제페이지가 아니라 홈/상품상세/콘텐츠 페이지에서 시작되는 경우를 잡는다.

현재 firstTouch는 `checkout_started` 이후만 보존한다. 그래서 TikTok 광고를 클릭한 뒤 나중에 direct, Meta, 검색으로 돌아와 구매하면 내부 TikTok 후보에서 빠질 수 있다. 이 스니펫은 `ttclid` 또는 TikTok UTM이 보이는 최초 랜딩을 `marketing_intent`로 남기고, 이후 `payment_success`가 같은 `clientId/userPseudoId/gaSessionId`로 들어오면 7일 window 안에서 firstTouch 후보로 연결하기 위한 코드다.

## 붙이는 위치

아임웹 `Body Code` 또는 기존 Biocom footer의 UTM persistence 블록 뒤.

기존 TikTok Purchase Guard 헤더와 역할이 다르다. Guard는 Purchase 차단/허용이고, 이 스니펫은 광고 클릭 intent 보존이다.

```html
<script>
/* TikTok marketing intent capture
 * Version: 2026-05-02.tiktok-marketing-intent-v1
 * Sends only when current landing has ttclid or TikTok UTM/referrer evidence.
 */
(function () {
  'use strict';

  var CONFIG = {
    endpoint: 'https://att.ainativeos.net/api/attribution/marketing-intent',
    source: 'biocom_imweb',
    measurementIds: ['G-WJFXN5E2Q1'],
    snippetVersion: '2026-05-02.tiktok-marketing-intent-v1',
    debugQueryKey: '__seo_attribution_debug',
    dedupeKeyPrefix: '__seo_tiktok_marketing_intent_sent__:'
  };

  function trim(value) {
    if (value == null) return '';
    return String(value).trim();
  }

  function isDebugMode() {
    return new URLSearchParams(location.search).get(CONFIG.debugQueryKey) === '1';
  }

  function debugLog() {
    if (!isDebugMode()) return;
    try {
      console.log.apply(console, ['[seo-tiktok-intent]'].concat([].slice.call(arguments)));
    } catch (error) {}
  }

  function readCookie(name) {
    var pattern = new RegExp('(?:^|; )' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)');
    var match = document.cookie.match(pattern);
    return match ? decodeURIComponent(match[1]) : '';
  }

  function parseClientIdFromGaCookie(cookieValue) {
    if (!cookieValue) return '';
    var parts = cookieValue.split('.');
    if (parts.length >= 4) return parts.slice(-2).join('.');
    return '';
  }

  function parseSessionIdFromGaCookie(cookieValue) {
    if (!cookieValue) return '';
    if (cookieValue.indexOf('GS1.') === 0) {
      var gs1 = cookieValue.split('.');
      return trim(gs1[2]);
    }
    if (cookieValue.indexOf('GS2.') === 0) {
      var body = cookieValue.split('.').slice(2).join('.');
      var chunks = body.split('$');
      for (var i = 0; i < chunks.length; i += 1) {
        if (chunks[i].indexOf('s') === 0) return trim(chunks[i].slice(1));
      }
    }
    return '';
  }

  function getMeasurementCookieName(measurementId) {
    return '_ga_' + trim(measurementId).replace(/^G-/, '');
  }

  function readGaIdentifiers() {
    var clientId = parseClientIdFromGaCookie(readCookie('_ga'));
    var gaSessionId = '';
    for (var i = 0; i < CONFIG.measurementIds.length; i += 1) {
      gaSessionId = parseSessionIdFromGaCookie(readCookie(getMeasurementCookieName(CONFIG.measurementIds[i])));
      if (gaSessionId) break;
    }
    return {
      clientId: clientId,
      userPseudoId: clientId,
      gaSessionId: gaSessionId
    };
  }

  function includesTikTok(value) {
    return trim(value).toLowerCase().indexOf('tiktok') >= 0;
  }

  function hasTikTokEvidence(tracking) {
    return Boolean(
      tracking.ttclid ||
      includesTikTok(tracking.utm_source) ||
      includesTikTok(tracking.utm_medium) ||
      includesTikTok(tracking.utm_campaign) ||
      includesTikTok(tracking.utm_content) ||
      includesTikTok(tracking.utm_term) ||
      includesTikTok(tracking.referrer)
    );
  }

  function collectTracking() {
    var params = new URLSearchParams(location.search);
    return {
      utm_source: trim(params.get('utm_source')),
      utm_medium: trim(params.get('utm_medium')),
      utm_campaign: trim(params.get('utm_campaign')),
      utm_content: trim(params.get('utm_content')),
      utm_term: trim(params.get('utm_term')),
      ttclid: trim(params.get('ttclid')),
      landing: location.href,
      referrer: document.referrer || ''
    };
  }

  function dedupeKey(tracking) {
    return CONFIG.dedupeKeyPrefix + [
      tracking.ttclid || 'no_ttclid',
      tracking.utm_campaign || 'no_campaign',
      tracking.utm_content || 'no_content',
      location.pathname
    ].join('|');
  }

  function alreadySentRecently(key) {
    try {
      if (!window.localStorage) return false;
      var raw = window.localStorage.getItem(key);
      var sentAt = raw ? Number(raw) : 0;
      return sentAt > 0 && Date.now() - sentAt < 24 * 60 * 60 * 1000;
    } catch (error) {
      return false;
    }
  }

  function markSent(key) {
    try {
      if (!window.localStorage) return;
      window.localStorage.setItem(key, String(Date.now()));
    } catch (error) {}
  }

  function sendIntent() {
    var tracking = collectTracking();
    if (!hasTikTokEvidence(tracking)) {
      debugLog('skip: no TikTok landing evidence');
      return;
    }

    var key = dedupeKey(tracking);
    if (alreadySentRecently(key)) {
      debugLog('skip: duplicate within 24h');
      return;
    }

    var ga = readGaIdentifiers();
    var payload = {
      source: CONFIG.source,
      landing: tracking.landing,
      referrer: tracking.referrer,
      gaSessionId: ga.gaSessionId,
      utmSource: tracking.utm_source,
      utmMedium: tracking.utm_medium,
      utmCampaign: tracking.utm_campaign,
      utmTerm: tracking.utm_term,
      utmContent: tracking.utm_content,
      ttclid: tracking.ttclid,
      captureMode: 'live',
      metadata: {
        source: CONFIG.source,
        snippetVersion: CONFIG.snippetVersion,
        intentChannel: 'tiktok',
        intentLookbackDays: 7,
        clientId: ga.clientId,
        userPseudoId: ga.userPseudoId,
        ttp: readCookie('_ttp'),
        pageTitle: document.title || '',
        capturedAt: new Date().toISOString()
      }
    };

    fetch(CONFIG.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'omit',
      mode: 'cors',
      keepalive: true
    }).then(function (response) {
      if (response.ok) markSent(key);
      debugLog('sent', response.status, payload);
    }).catch(function (error) {
      debugLog('send failed', error && error.message ? error.message : error);
    });
  }

  sendIntent();
})();
</script>
```

## 운영 반영 전 확인

1. TJ 관리 Attribution VM에 `/api/attribution/marketing-intent` 배포가 먼저 필요하다.
2. 테스트 URL 예: `https://biocom.kr/?utm_source=tiktok&utm_medium=paid&utm_campaign=codex_test&ttclid=codex_test_20260502`
3. 개발자도구 Network에서 `marketing-intent` 201 또는 duplicate 200 확인.
4. Attribution VM `CRM_LOCAL_DB_PATH#attribution_ledger`에서 `touchpoint=marketing_intent`, `metadata_json.intentChannel=tiktok` 확인.
5. 같은 브라우저에서 카드 결제 1건을 완료하고 `payment_success.metadata_json.firstTouch.touchpoint=marketing_intent` 연결 여부 확인.
