---
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/coffee-data/README.md
    - harness/coffee-data/RULES.md
    - harness/coffee-data/VERIFY.md
    - harness/coffee-data/AUDITOR_CHECKLIST.md
  required_context_docs:
    - imweb/code_coffee_260527.md
    - report/reportcoffee-attribution-preservation-map-20260527.md
  lane: Green
  allowed_actions:
    - candidate snippet design
    - no-send preview logic
    - local fixture
    - document update
  forbidden_actions:
    - Imweb save/publish
    - GTM publish
    - external platform send
    - production DB write
    - VM Cloud deploy/restart
  source_window_freshness_confidence:
    source: "imweb/code_coffee_260527.md + 2026-05-27 Coffee Naver brandsearch smoke"
    window: "2026-05-27 KST same-day code and live smoke"
    freshness: "same-day"
    confidence: 0.88
---

# 더클린커피 payment_page_seen + NaPm 구조화 후보

작성 시각: 2026-05-27 KST
문서 성격: 아임웹 운영 반영 전 no-send 후보. 이 문서는 붙여넣기 승인안이 아니라 설계/후보 코드다.

## 10초 요약

Coffee 네이버 브랜드검색 smoke에서 `checkout_started`와 `payment_success`까지 UTM/NaPm evidence가 남는 것은 확인됐다.
남은 문제는 두 가지다.

1. 주문서 진입이 `payment_page_seen`이라는 별도 단계로 남지 않는다.
2. `NaPm`은 landing URL 문자열에만 남고 구조화 필드로 분리되지 않는다.

따라서 운영 반영 후보는 전체 footer 교체가 아니라 아래 두 부분 patch다.

- `payment_page_seen` no-send preview block: `/shop_payment/`에서 dataLayer/console/window snapshot만 생성한다. VM write와 platform send는 하지 않는다.
- `NaPm/srsltid` 구조화 helper: raw click token은 저장하지 않고 `present/source/tr/nacn` 같은 안전한 요약 필드를 touch/context/payload metadata에 붙인다.

승인 판단 문서: [[imweb/coffee-payment-page-seen-debug-snapshot-approval-20260527]]

## 현재 확인된 사실

- Coffee `checkout_started`: VM Cloud row에 `utm_source=naver_brand_search`, `utm_medium=naver_brand_search`, landing `NaPm` evidence가 남았다.
- Coffee `payment_success`: 가상계좌 미입금 완료 row에도 같은 네이버 브랜드검색 evidence가 남았다.
- Coffee Meta browser: `InitiateCheckout`, `AddPaymentInfo`, `PurchaseDecisionUnknown` 관측.
- Coffee Purchase Guard: 미입금 가상계좌를 Purchase로 통과시키지 않고 unknown 계열로 격리했다.
- Coffee gap: `payment_page_seen` touchpoint는 아직 없다.
- Coffee Google Ads smoke: `last_touch`와 `__thecleancoffee_click_id_context_v1` local/session에는 `google/cpc`, `gclid`, `gbraid`, `gad_campaignid`가 남지만, `__seo_checkout_context`와 `__seo_payment_success_context` debug snapshot은 UTM/click evidence가 비어 보인다.
- 해석: 서버 수신 row는 click evidence를 보존하므로 attribution 자체 실패는 아니다. 다만 주문서/결제완료 단계의 browser snapshot에도 click context를 병합하면 현장 디버깅과 보고서 판독이 더 안정적이다.

## 후보 1 — payment_page_seen no-send preview block

### 목적

`checkout_started=결제 시작/주문서 후보`와 `payment_page_seen=실제 주문서 화면 도달`을 분리한다.
이 후보는 운영 반영 전 preview 단계이므로 VM Cloud에도 쓰지 않는다.

### 배치 위치 후보

Coffee footer Block 2 `checkout_started` 뒤, Block 3 `payment_success` 앞.

이유:

- `/shop_payment/` 화면에서만 동작해야 한다.
- 결제완료 화면의 `payment_success`와 섞이면 안 된다.
- Meta `InitiateCheckout`과 별개 내부 진단 신호로 둔다.

### no-send 후보 코드

```html
<script>
/* ── Candidate: Coffee payment_page_seen no-send preview v1 ──
   Version: 2026-05-27-coffee-payment-page-seen-preview-v1
   Scope:
   - /shop_payment/ only.
   - No VM write while enableNetworkSend=false.
   - No Meta/GA4/Google/Naver/TikTok send.
   - Produces dataLayer + window preview snapshot only.
*/
(function () {
  var CONFIG = {
    snippetVersion: '2026-05-27-coffee-payment-page-seen-preview-v1',
    source: 'thecleancoffee_imweb',
    site: 'thecleancoffee',
    endpoint: 'https://att.ainativeos.net/api/attribution/payment-page-seen',
    enableNetworkSend: false,
    debugQueryKey: '__seo_attribution_debug',
    clickContextKey: '__thecleancoffee_click_id_context_v1',
    checkoutContextKey: '__seo_checkout_context',
    previewWindowKey: '__THECLEANCOFFEE_PAYMENT_PAGE_SEEN_PREVIEW_LAST__',
    dedupePrefix: '__thecleancoffee_payment_page_seen_preview_sent_v1__:'
  };

  function trim(value) {
    if (value == null) return '';
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

  function readJson(storage, key) {
    try {
      if (!storage) return {};
      return safeParse(storage.getItem(key));
    } catch (error) {
      return {};
    }
  }

  function firstNonEmpty(values) {
    for (var i = 0; i < values.length; i += 1) {
      var value = trim(values[i]);
      if (value) return value;
    }
    return '';
  }

  function getSearchParam(keys, sourceUrl) {
    try {
      var url = new URL(sourceUrl || location.href, location.origin);
      for (var i = 0; i < keys.length; i += 1) {
        var value = trim(url.searchParams.get(keys[i]));
        if (value) return value;
      }
    } catch (error) {}
    return '';
  }

  function isDebugMode() {
    try {
      return new URLSearchParams(location.search).get(CONFIG.debugQueryKey) === '1';
    } catch (error) {
      return false;
    }
  }

  function debugLog(label, value) {
    if (!isDebugMode()) return;
    try {
      console.info('[coffee-payment-page-seen-preview]', label, value || '');
    } catch (error) {}
  }

  function isPaymentPage() {
    var href = String(location.href).toLowerCase();
    var path = String(location.pathname).toLowerCase();
    if (href.indexOf('shop_payment_complete') >= 0) return false;
    if (href.indexOf('shop_order_done') >= 0) return false;
    return path.indexOf('/shop_payment') >= 0;
  }

  function hasSent(key) {
    try {
      return Boolean(sessionStorage && sessionStorage.getItem(key));
    } catch (error) {
      return false;
    }
  }

  function markSent(key) {
    try {
      if (sessionStorage) sessionStorage.setItem(key, new Date().toISOString());
    } catch (error) {}
  }

  function naverEvidenceFrom(value, sourceName) {
    var out = {
      naver_evidence_source: sourceName || '',
      naver_brandsearch_utm_present: false,
      napm_present: false,
      napm_ct: '',
      napm_tr: '',
      napm_nacn: '',
      napm_ci_present: false,
      napm_hk_present: false,
      srsltid_present: false,
      srsltid_source: '',
      n_media: '',
      n_query_present: false
    };

    try {
      var url = new URL(value || '', location.origin);
      var params = url.searchParams;
      var utmSource = trim(params.get('utm_source'));
      var utmMedium = trim(params.get('utm_medium'));
      out.naver_brandsearch_utm_present = /naver[_-]?brand/i.test(utmSource + ' ' + utmMedium);

      var napmRaw = trim(params.get('NaPm'));
      if (napmRaw) {
        out.napm_present = true;
        napmRaw.split('|').forEach(function (part) {
          var index = part.indexOf('=');
          if (index <= 0) return;
          var key = part.slice(0, index);
          var val = part.slice(index + 1);
          if (key === 'ct') out.napm_ct = val.slice(0, 40);
          if (key === 'tr') out.napm_tr = val.slice(0, 40);
          if (key === 'nacn') out.napm_nacn = val.slice(0, 80);
          if (key === 'ci') out.napm_ci_present = Boolean(val);
          if (key === 'hk') out.napm_hk_present = Boolean(val);
        });
      }

      out.srsltid_present = Boolean(trim(params.get('srsltid')));
      out.srsltid_source = out.srsltid_present ? sourceName || '' : '';
      out.n_media = trim(params.get('n_media')).slice(0, 80);
      out.n_query_present = Boolean(trim(params.get('n_query')));
    } catch (error) {}

    return out;
  }

  function pickNaverEvidence(candidates) {
    for (var i = 0; i < candidates.length; i += 1) {
      var evidence = naverEvidenceFrom(candidates[i].value, candidates[i].source);
      if (
        evidence.naver_brandsearch_utm_present ||
        evidence.napm_present ||
        evidence.srsltid_present ||
        evidence.n_media ||
        evidence.n_query_present
      ) {
        return evidence;
      }
    }
    return naverEvidenceFrom('', 'none');
  }

  if (!isPaymentPage()) return;

  var lastTouch = readJson(localStorage, '_p1s1a_last_touch');
  var clickContext = readJson(sessionStorage, CONFIG.clickContextKey);
  if (!Object.keys(clickContext).length) clickContext = readJson(localStorage, CONFIG.clickContextKey);
  var checkoutContext = readJson(sessionStorage, CONFIG.checkoutContextKey);
  var orderCode = firstNonEmpty([
    getSearchParam(['order_code', 'orderCode']),
    getSearchParam(['order_code', 'orderCode'], document.referrer)
  ]);
  var orderNo = firstNonEmpty([
    getSearchParam(['order_no', 'orderNo', 'order_id', 'orderId']),
    getSearchParam(['order_no', 'orderNo', 'order_id', 'orderId'], document.referrer)
  ]);
  var checkoutId = firstNonEmpty([
    trim(checkoutContext.checkoutId),
    trim(sessionStorage && sessionStorage.getItem('__seo_checkout_id'))
  ]);
  var naverEvidence = pickNaverEvidence([
    { source: 'current_url', value: location.href },
    { source: 'document_referrer', value: document.referrer },
    { source: 'checkout_context_landing', value: checkoutContext.landing },
    { source: 'coffee_click_context_landing', value: clickContext.landing },
    { source: 'last_touch_landing', value: lastTouch.landing }
  ]);
  var dedupeKey = CONFIG.dedupePrefix + firstNonEmpty([orderCode, orderNo, checkoutId, location.href]);

  if (dedupeKey && hasSent(dedupeKey)) {
    debugLog('skip duplicate', { orderCodePresent: Boolean(orderCode), orderNoPresent: Boolean(orderNo) });
    return;
  }

  var payload = {
    touchpoint: 'payment_page_seen',
    captureMode: CONFIG.enableNetworkSend ? 'live' : 'preview',
    source: CONFIG.source,
    checkoutId: checkoutId,
    orderCode: orderCode,
    orderId: orderNo,
    clientObservedAt: new Date().toISOString(),
    landing: firstNonEmpty([trim(clickContext.landing), trim(lastTouch.landing), location.href]),
    referrer: document.referrer || '',
    utm_source: firstNonEmpty([trim(clickContext.utm_source), trim(lastTouch.utm_source)]),
    utm_medium: firstNonEmpty([trim(clickContext.utm_medium), trim(lastTouch.utm_medium)]),
    utm_campaign: firstNonEmpty([trim(clickContext.utm_campaign), trim(lastTouch.utm_campaign)]),
    gclid: firstNonEmpty([trim(clickContext.gclid), trim(lastTouch.gclid)]),
    gbraid: firstNonEmpty([trim(clickContext.gbraid), trim(lastTouch.gbraid)]),
    wbraid: firstNonEmpty([trim(clickContext.wbraid), trim(lastTouch.wbraid)]),
    gad_source: firstNonEmpty([trim(clickContext.gad_source), trim(lastTouch.gad_source)]),
    gad_campaignid: firstNonEmpty([trim(clickContext.gad_campaignid), trim(lastTouch.gad_campaignid)]),
    metadata: {
      snippetVersion: CONFIG.snippetVersion,
      semantic_touchpoint: 'payment_page_seen',
      page_location_class: 'shop_payment',
      no_send: !CONFIG.enableNetworkSend,
      no_platform_send: true,
      order_code_present: Boolean(orderCode),
      order_no_present: Boolean(orderNo),
      checkout_id_present: Boolean(checkoutId),
      google_click_id_source: firstNonEmpty([trim(clickContext.google_click_id_source), trim(lastTouch.google_click_id_source)]),
      gad_campaignid_source: firstNonEmpty([trim(clickContext.gad_campaignid_source), trim(lastTouch.gad_campaignid_source)]),
      naverEvidence: naverEvidence
    }
  };

  var preview = {
    event: 'coffee_payment_page_seen_preview',
    eventName: 'payment_page_seen',
    noSend: !CONFIG.enableNetworkSend,
    noPlatformSend: true,
    pagePath: location.pathname,
    snippetVersion: CONFIG.snippetVersion,
    orderCodePresent: Boolean(orderCode),
    orderNoPresent: Boolean(orderNo),
    checkoutIdPresent: Boolean(checkoutId),
    utm_source: payload.utm_source,
    utm_medium: payload.utm_medium,
    has_gclid: Boolean(payload.gclid),
    has_gbraid: Boolean(payload.gbraid),
    has_wbraid: Boolean(payload.wbraid),
    gad_campaignid_present: Boolean(payload.gad_campaignid),
    naverEvidence: naverEvidence
  };

  window[CONFIG.previewWindowKey] = preview;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(preview);
  debugLog('preview', preview);
  markSent(dedupeKey);

  if (!CONFIG.enableNetworkSend) return;

  fetch(CONFIG.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
    credentials: 'omit',
    mode: 'cors'
  }).then(function (response) {
    debugLog('send result', { ok: response.ok, status: response.status });
  }).catch(function (error) {
    debugLog('send failed', error && error.message ? error.message : error);
  });
})();
</script>
```

## 후보 2 — NaPm / srsltid 구조화 helper

### 저장 원칙

- 저장한다: `napm_present`, `napm_tr`, `napm_ct`, `napm_nacn`, `napm_ci_present`, `napm_hk_present`, `srsltid_present`, `srsltid_source`, `n_media`, `n_query_present`.
- 저장하지 않는다: raw `NaPm`, raw `ci`, raw `hk`, raw `srsltid`, raw search query.
- 이유: attribution 분류에는 존재 여부와 type/source가 중요하고, raw click token을 브라우저/원장에 늘릴 필요는 없다.

### helper 삽입 후보

현재 Coffee header-top click-id block과 footer Block 1/2/3에 같은 helper를 넣는다.

```js
function naverEvidenceFromUrl(urlLike, sourceName) {
  var out = {
    naver_evidence_source: sourceName || '',
    naver_brandsearch_utm_present: false,
    napm_present: false,
    napm_ct: '',
    napm_tr: '',
    napm_nacn: '',
    napm_ci_present: false,
    napm_hk_present: false,
    srsltid_present: false,
    srsltid_source: '',
    n_media: '',
    n_query_present: false
  };

  try {
    var url = new URL(urlLike || '', location.origin);
    var params = url.searchParams;
    var utmSource = trim(params.get('utm_source'));
    var utmMedium = trim(params.get('utm_medium'));
    out.naver_brandsearch_utm_present = /naver[_-]?brand/i.test(utmSource + ' ' + utmMedium);

    var napmRaw = trim(params.get('NaPm'));
    if (napmRaw) {
      out.napm_present = true;
      napmRaw.split('|').forEach(function (part) {
        var index = part.indexOf('=');
        if (index <= 0) return;
        var key = part.slice(0, index);
        var val = part.slice(index + 1);
        if (key === 'ct') out.napm_ct = val.slice(0, 40);
        if (key === 'tr') out.napm_tr = val.slice(0, 40);
        if (key === 'nacn') out.napm_nacn = val.slice(0, 80);
        if (key === 'ci') out.napm_ci_present = Boolean(val);
        if (key === 'hk') out.napm_hk_present = Boolean(val);
      });
    }

    out.srsltid_present = Boolean(trim(params.get('srsltid')));
    out.srsltid_source = out.srsltid_present ? sourceName || '' : '';
    out.n_media = trim(params.get('n_media')).slice(0, 80);
    out.n_query_present = Boolean(trim(params.get('n_query')));
  } catch (error) {}

  return out;
}

function selectNaverEvidence(candidates) {
  for (var i = 0; i < candidates.length; i += 1) {
    var evidence = naverEvidenceFromUrl(candidates[i].value, candidates[i].source);
    if (
      evidence.naver_brandsearch_utm_present ||
      evidence.napm_present ||
      evidence.srsltid_present ||
      evidence.n_media ||
      evidence.n_query_present
    ) {
      return evidence;
    }
  }
  return naverEvidenceFromUrl('', 'none');
}
```

### touch/context에 붙일 필드

`_p1s1a_last_touch`, `__thecleancoffee_click_id_context_v1`, `__seo_checkout_context`, `payment_success.metadata`에 아래를 추가한다.

```js
naver_evidence_source: naverEvidence.naver_evidence_source,
naver_brandsearch_utm_present: naverEvidence.naver_brandsearch_utm_present,
napm_present: naverEvidence.napm_present,
napm_ct: naverEvidence.napm_ct,
napm_tr: naverEvidence.napm_tr,
napm_nacn: naverEvidence.napm_nacn,
napm_ci_present: naverEvidence.napm_ci_present,
napm_hk_present: naverEvidence.napm_hk_present,
srsltid_present: naverEvidence.srsltid_present,
srsltid_source: naverEvidence.srsltid_source,
n_media: naverEvidence.n_media,
n_query_present: naverEvidence.n_query_present
```

## 운영 반영 전 체크리스트

1. Imweb live 코드 백업.
2. `payment_page_seen` preview block을 실제 저장하기 전에도 `enableNetworkSend=false` 유지.
3. GTM/Meta Pixel Helper에서 새 Meta event가 늘지 않는지 확인.
4. `window.__THECLEANCOFFEE_PAYMENT_PAGE_SEEN_PREVIEW_LAST__` 값만 확인.
5. `dataLayer`에 `coffee_payment_page_seen_preview`가 1회만 쌓이는지 확인.
6. VM Cloud row가 늘지 않는지 확인.
7. 운영 row가 필요해질 때만 별도 승인 후 `enableNetworkSend=true`와 `/api/attribution/payment-page-seen` 수신 검증.

## Google Ads smoke 전환 기준

위 두 후보는 아직 운영 반영하지 않는다.
다음 테스트는 Google Ads click id 보존 smoke로 전환한다.

테스트 URL 후보:

```text
https://thecleancoffee.com/?utm_source=google&utm_medium=cpc&utm_campaign=coffee_google_smoke_0527&gclid=TJ_GCLID_0527&gbraid=TJ_GBRAID_0527&gad_campaignid=14629255429&gad_source=1&__seo_attribution_debug=1
```

주의:

- 이 URL은 synthetic smoke다. Google Ads upload 가능한 실제 click id가 아니다.
- 목적은 브라우저 저장, 주문서, 결제완료, VM Cloud row의 보존성 확인이다.
- 예산 판단용 internal confirmed ROAS에는 실제 광고 클릭과 실제 결제완료 주문 evidence가 필요하다.
