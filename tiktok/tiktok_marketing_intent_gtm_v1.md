# TikTok Marketing Intent GTM v1

작성 시각: 2026-05-02 19:10 KST
상태: 검토 완료. 아임웹 헤더/푸터 대신 GTM으로 처리 가능.
대상: TikTok ROAS gap 원인 중 “광고 클릭 후 재방문 구매가 내부 원장에 안 붙는 문제”
저장 대상: TJ 관리 Attribution VM SQLite `CRM_LOCAL_DB_PATH#attribution_ledger`
엔드포인트: `https://att.ainativeos.net/api/attribution/marketing-intent`
자신감: 86%

## 결론

이번 `marketing_intent` 수집은 GTM으로 해결 가능하다.

다만 모든 TikTok 관련 코드를 GTM으로 옮기면 안 된다. 역할을 분리해야 한다.

| 기능 | GTM 가능 여부 | 이유 |
|---|---|---|
| TikTok 광고 클릭 intent 저장 | 가능 | Page URL, Referrer, cookie를 읽어 내부 endpoint로 POST하면 된다 |
| TikTok Purchase Guard | 비추천 | TikTok Pixel `Purchase`를 먼저 가로채야 해서 GTM 로딩 순서가 늦으면 실패할 수 있다 |
| 결제완료 `payment_success` | 기존 아임웹 footer 유지 권장 | 주문번호/결제코드/아임웹 결제완료 페이지 문맥을 이미 안정적으로 수집 중이다 |
| 서버 매칭 로직 | GTM 불가 | `payment_success`와 7일 전 `marketing_intent`를 연결하는 일은 TJ 관리 Attribution VM backend가 해야 한다 |

따라서 권장 구조는 아래다.

1. 아임웹 헤더: 현재 TikTok Purchase Guard 유지
2. 아임웹 footer: 현재 checkout/payment_success 유지
3. GTM: TikTok `marketing_intent`만 신규 추가
4. TJ 관리 Attribution VM: `/api/attribution/marketing-intent` receiver와 firstTouch 연결 로직 배포

## 왜 GTM이 맞는가

Google Tag Manager의 Custom HTML Tag는 기본 템플릿에 없는 태그를 배포할 때 쓰는 기능이다. 즉 내부 수집용 `fetch()` 태그를 넣기에 맞다.

또 GTM Preview/Debug 모드로 publish 전에 실제 사이트에서 태그가 fired 되는지 확인할 수 있다.

공식 근거:

- Google Tag Manager Custom HTML Tag: https://support.google.com/tagmanager/answer/6107167
- Google Tag Manager Preview/Debug: https://support.google.com/tagmanager/answer/6107056

## GTM 설정안

### 1. Tag

Tag type: `Custom HTML`

Tag name:

```text
SEO - TikTok Marketing Intent - v1
```

Custom HTML:

```html
<script>
/* TikTok marketing intent capture via GTM
 * Version: 2026-05-02.tiktok-marketing-intent-gtm-v1
 */
(function () {
  'use strict';

  var CONFIG = {
    endpoint: 'https://att.ainativeos.net/api/attribution/marketing-intent',
    source: 'biocom_imweb',
    measurementIds: ['G-WJFXN5E2Q1'],
    snippetVersion: '2026-05-02.tiktok-marketing-intent-gtm-v1',
    debugQueryKey: '__seo_attribution_debug',
    dedupeKeyPrefix: '__seo_tiktok_marketing_intent_sent__:'
  };

  function trim(value) {
    if (value == null) return '';
    return String(value).trim();
  }

  function debugLog() {
    if (new URLSearchParams(location.search).get(CONFIG.debugQueryKey) !== '1') return;
    try {
      console.log.apply(console, ['[seo-tiktok-intent-gtm]'].concat([].slice.call(arguments)));
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
      if (window.localStorage) window.localStorage.setItem(key, String(Date.now()));
    } catch (error) {}
  }

  var tracking = collectTracking();
  if (!hasTikTokEvidence(tracking)) {
    debugLog('skip: no TikTok evidence');
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
})();
</script>
```

### 2. Trigger

Trigger type: `Initialization - All Pages`

아래 조건은 OR가 필요하므로 트리거를 3개 만들고 같은 tag에 모두 붙인다.

| Trigger name | 조건 |
|---|---|
| `SEO - TikTok Intent - ttclid` | `Page URL` contains `ttclid=` |
| `SEO - TikTok Intent - UTM` | `Page URL` matches RegEx `utm_(source|medium|campaign|content|term)=[^&#]*tiktok` |
| `SEO - TikTok Intent - Referrer` | `Referrer` contains `tiktok.com` |

Tag firing options:

```text
Once per page
```

## 검증 순서

1. TJ 관리 Attribution VM backend에 `/api/attribution/marketing-intent` receiver를 배포한다.
2. GTM Preview를 켠다.
3. 아래 URL로 접속한다.

```text
https://biocom.kr/?utm_source=tiktok&utm_medium=paid&utm_campaign=codex_gtm_test&ttclid=codex_gtm_20260502
```

4. GTM Preview에서 `SEO - TikTok Marketing Intent - v1` tag fired 확인.
5. 브라우저 Network에서 `marketing-intent` 요청이 201인지 확인.
6. TJ 관리 Attribution VM SQLite `CRM_LOCAL_DB_PATH#attribution_ledger`에서 `touchpoint=marketing_intent` row 확인.
7. 같은 브라우저로 카드 결제 테스트 1건을 하고 `payment_success.metadata_json.firstTouch.touchpoint=marketing_intent`가 붙는지 확인한다.

## 위험과 한계

| 위험 | 설명 | 대응 |
|---|---|---|
| GTM 차단 | 광고차단/브라우저 설정으로 GTM 자체가 막히면 intent도 빠진다 | 내부 기준 confidence를 100%로 보지 않는다 |
| VTA는 여전히 안 잡힘 | 조회 후 클릭 없이 구매한 VTA는 URL/Referrer 증거가 없다 | TikTok platform-only assisted로 분리한다 |
| backend 없이는 무의미 | GTM은 보내기만 하고 7일 매칭은 못 한다 | VM receiver 배포가 선행 조건 |
| Purchase Guard 대체 불가 | Guard는 TikTok Pixel보다 먼저 실행되어야 한다 | Guard는 아임웹 헤더 유지 |

## 판단

GTM 방식으로 먼저 가는 것을 권장한다.

이유는 아임웹 헤더/푸터 코드를 더 길게 만들지 않고, Preview로 태그 fired 여부를 확인하고, 문제가 생기면 GTM에서 바로 pause할 수 있기 때문이다.

단, 이 작업은 “TikTok 클릭 intent 보존”만 해결한다. TikTok 플랫폼 VTA 매출을 내부 confirmed로 바꾸는 작업은 아니다.
