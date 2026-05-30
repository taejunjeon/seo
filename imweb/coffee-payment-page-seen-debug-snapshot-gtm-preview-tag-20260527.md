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
    - imweb/coffee-payment-page-seen-debug-snapshot-approval-20260527.md
    - imweb/code_coffee_payment_page_seen_napm_structured_candidate_260527.md
  lane: Green no-send tag candidate
  allowed_actions:
    - candidate code writing
    - no-send/no-write static review
  forbidden_actions:
    - GTM Preview execution before approval
    - GTM Production publish
    - Imweb save/publish
    - VM Cloud write
    - platform send
    - production DB write
  source_window_freshness_confidence:
    source: "2026-05-27 Coffee smoke + approval packet"
    window: "2026-05-27 KST"
    freshness: "same-day"
    confidence: 0.88
---

# Coffee payment_page_seen + debug snapshot GTM Preview 태그 후보

작성 시각: 2026-05-27 14:19 KST
기준일: 2026-05-27
문서 성격: GTM Custom HTML 후보. 승인 전 GTM에 만들지 않는다.
승인 판단 문서: [[imweb/coffee-payment-page-seen-debug-snapshot-approval-20260527]]

## 10초 요약

이 태그 후보는 더클린커피 주문서와 주문완료 화면에서 브라우저 디버그 snapshot을 보기 쉽게 만드는 no-send Preview 전용 코드다.

하는 일:

- `/shop_payment/` 주문서에서 `payment_page_seen` preview snapshot을 만든다.
- `/shop_payment_complete` 또는 `/shop_order_done`에서 `payment_success_debug_snapshot` preview snapshot을 만든다.
- Google/Naver evidence를 raw token 없이 요약값으로 병합한다.
- Biocom과 구현 위치가 달라도 헷갈리지 않도록 `site`, `source`, `owner_surface`를 명시한다.

하지 않는 일:

- VM Cloud로 보내지 않는다.
- Meta/GA4/Google Ads/Naver/TikTok으로 보내지 않는다.
- Purchase, PurchaseDecision, conversion 이벤트를 만들지 않는다.
- raw `gclid`, `gbraid`, `wbraid`, raw `NaPm`, raw `ci`, raw `hk`, raw `srsltid`, raw order/payment/member/email/phone을 저장하지 않는다.

## GTM 태그 설정 후보

태그 이름:

```text
codex_coffee_payment_page_seen_debug_snapshot_nosend_preview_20260527
```

태그 유형:

```text
Custom HTML
```

트리거 후보:

```text
DOM Ready
Some DOM Ready Events
Page Path contains /shop_payment
```

주의:

- `/shop_payment_complete`도 `Page Path contains /shop_payment`에 포함된다.
- 코드 내부에서 주문서와 완료 화면을 다시 분기한다.

## Custom HTML 후보

```html
<script>
(function () {
  var CONFIG = {
    snippetVersion: '2026-05-27-coffee-payment-page-seen-debug-snapshot-nosend-preview-v1',
    site: 'thecleancoffee',
    source: 'thecleancoffee_gtm_preview',
    ownerSurface: 'gtm_preview',
    debugQueryKey: '__seo_attribution_debug',
    clickContextKey: '__thecleancoffee_click_id_context_v1',
    checkoutContextKey: '__seo_checkout_context',
    checkoutPreviewKey: '__seo_checkout_context_debug_merged_preview',
    paymentPreviewKey: '__seo_payment_success_context_debug_merged_preview',
    windowPreviewKey: '__THECLEANCOFFEE_PAYMENT_PAGE_SEEN_PREVIEW_LAST__'
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

  function writeJson(storage, key, value) {
    try {
      if (!storage) return;
      storage.setItem(key, JSON.stringify(value));
    } catch (error) {}
  }

  function firstNonEmpty(values) {
    for (var i = 0; i < values.length; i += 1) {
      var value = trim(values[i]);
      if (value) return value;
    }
    return '';
  }

  function parseUrl(value) {
    try {
      return new URL(value || location.href, location.origin);
    } catch (error) {
      return null;
    }
  }

  function parseNapmSummary(landing) {
    var out = {
      napm_present: false,
      napm_ct: '',
      napm_tr: '',
      napm_nacn: '',
      napm_ci_present: false,
      napm_hk_present: false
    };
    var url = parseUrl(landing);
    if (!url) return out;
    var raw = trim(url.searchParams.get('NaPm'));
    if (!raw) return out;
    out.napm_present = true;
    raw.split('|').forEach(function (part) {
      var index = part.indexOf('=');
      if (index <= 0) return;
      var key = part.slice(0, index);
      var value = part.slice(index + 1);
      if (key === 'ct') out.napm_ct = value.slice(0, 40);
      if (key === 'tr') out.napm_tr = value.slice(0, 40);
      if (key === 'nacn') out.napm_nacn = value.slice(0, 80);
      if (key === 'ci') out.napm_ci_present = Boolean(value);
      if (key === 'hk') out.napm_hk_present = Boolean(value);
    });
    return out;
  }

  function getParamFromUrlLike(source, name) {
    var url = parseUrl(source);
    return url ? trim(url.searchParams.get(name)) : '';
  }

  function summarizeTouch(touch, sourceName) {
    var landing = firstNonEmpty([
      touch.landing,
      touch.url,
      touch.href,
      touch.path && touch.path.indexOf('http') === 0 ? touch.path : ''
    ]);
    var napm = parseNapmSummary(landing);
    var srsltid = firstNonEmpty([touch.srsltid, getParamFromUrlLike(landing, 'srsltid')]);

    return {
      source_name: sourceName,
      utm_source: firstNonEmpty([touch.utm_source, getParamFromUrlLike(landing, 'utm_source')]),
      utm_medium: firstNonEmpty([touch.utm_medium, getParamFromUrlLike(landing, 'utm_medium')]),
      utm_campaign: firstNonEmpty([touch.utm_campaign, getParamFromUrlLike(landing, 'utm_campaign')]),
      has_gclid: Boolean(touch.gclid || getParamFromUrlLike(landing, 'gclid')),
      has_gbraid: Boolean(touch.gbraid || getParamFromUrlLike(landing, 'gbraid')),
      has_wbraid: Boolean(touch.wbraid || getParamFromUrlLike(landing, 'wbraid')),
      gad_campaignid: firstNonEmpty([touch.gad_campaignid, getParamFromUrlLike(landing, 'gad_campaignid')]),
      gad_source: firstNonEmpty([touch.gad_source, getParamFromUrlLike(landing, 'gad_source')]),
      google_click_id_source: firstNonEmpty([touch.google_click_id_source, touch.googleClickIdSource]),
      napm_present: napm.napm_present,
      napm_ct: napm.napm_ct,
      napm_tr: napm.napm_tr,
      napm_nacn: napm.napm_nacn,
      napm_ci_present: napm.napm_ci_present,
      napm_hk_present: napm.napm_hk_present,
      srsltid_present: Boolean(srsltid),
      srsltid_source: srsltid ? sourceName : '',
      landing_has_napm: landing.indexOf('NaPm=') >= 0,
      landing_has_srsltid: landing.indexOf('srsltid=') >= 0
    };
  }

  function chooseSummary(items) {
    var fallback = items[0] && items[0].summary ? items[0].summary : {};
    for (var i = 0; i < items.length; i += 1) {
      var summary = items[i].summary;
      if (!summary) continue;
      if (summary.has_gclid || summary.has_gbraid || summary.has_wbraid || summary.utm_source || summary.napm_present || summary.srsltid_present) {
        return summary;
      }
    }
    return fallback;
  }

  function getPageKind() {
    var path = String(location.pathname || '').toLowerCase();
    var href = String(location.href || '').toLowerCase();
    if (href.indexOf('shop_payment_complete') >= 0 || href.indexOf('shop_order_done') >= 0) return 'payment_success_debug_snapshot';
    if (path.indexOf('/shop_payment') >= 0) return 'payment_page_seen';
    return '';
  }

  function isDebugMode() {
    try {
      return new URLSearchParams(location.search).get(CONFIG.debugQueryKey) === '1';
    } catch (error) {
      return false;
    }
  }

  var pageKind = getPageKind();
  if (!pageKind) return;

  var clickLocal = readJson(localStorage, CONFIG.clickContextKey);
  var clickSession = readJson(sessionStorage, CONFIG.clickContextKey);
  var lastTouch = readJson(localStorage, '_p1s1a_last_touch');
  var sessionTouch = readJson(sessionStorage, '_p1s1a_session_touch');
  var checkoutContext = readJson(sessionStorage, CONFIG.checkoutContextKey);

  var selected = chooseSummary([
    { summary: summarizeTouch(clickSession, 'coffee_click_context_session') },
    { summary: summarizeTouch(clickLocal, 'coffee_click_context_local') },
    { summary: summarizeTouch(lastTouch, 'last_touch') },
    { summary: summarizeTouch(sessionTouch, 'session_touch') },
    { summary: summarizeTouch(checkoutContext, 'checkout_context') }
  ]);

  var preview = {
    event: pageKind,
    site: CONFIG.site,
    source: CONFIG.source,
    owner_surface: CONFIG.ownerSurface,
    snippetVersion: CONFIG.snippetVersion,
    pagePath: location.pathname,
    noSend: true,
    noVmWrite: true,
    noPixelRequest: true,
    observedAt: new Date().toISOString(),
    source_name: selected.source_name || '',
    utm_source: selected.utm_source || '',
    utm_medium: selected.utm_medium || '',
    utm_campaign: selected.utm_campaign || '',
    has_gclid: !!selected.has_gclid,
    has_gbraid: !!selected.has_gbraid,
    has_wbraid: !!selected.has_wbraid,
    gad_campaignid: selected.gad_campaignid || '',
    gad_source: selected.gad_source || '',
    google_click_id_source: selected.google_click_id_source || '',
    napm_present: !!selected.napm_present,
    napm_ct: selected.napm_ct || '',
    napm_tr: selected.napm_tr || '',
    napm_nacn: selected.napm_nacn || '',
    napm_ci_present: !!selected.napm_ci_present,
    napm_hk_present: !!selected.napm_hk_present,
    srsltid_present: !!selected.srsltid_present,
    srsltid_source: selected.srsltid_source || '',
    landing_has_napm: !!selected.landing_has_napm,
    landing_has_srsltid: !!selected.landing_has_srsltid
  };

  window[CONFIG.windowPreviewKey] = preview;
  if (pageKind === 'payment_page_seen') {
    writeJson(sessionStorage, CONFIG.checkoutPreviewKey, preview);
  } else {
    writeJson(sessionStorage, CONFIG.paymentPreviewKey, preview);
  }

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: 'coffee_payment_page_seen_debug_snapshot_preview',
    coffee_payment_page_seen_debug_snapshot_preview: preview
  });

  if (isDebugMode() && window.console && console.info) {
    console.info('[coffee-payment-page-seen-debug-snapshot-preview]', preview);
  }
})();
</script>
```

## Preview 확인 콘솔

주문서:

```js
window.__THECLEANCOFFEE_PAYMENT_PAGE_SEEN_PREVIEW_LAST__
JSON.parse(sessionStorage.getItem('__seo_checkout_context_debug_merged_preview') || '{}')
```

주문완료:

```js
window.__THECLEANCOFFEE_PAYMENT_PAGE_SEEN_PREVIEW_LAST__
JSON.parse(sessionStorage.getItem('__seo_payment_success_context_debug_merged_preview') || '{}')
```

## 정적 no-send 검토

태그 후보 코드에는 아래 호출을 넣지 않는다.

- network request 생성
- pixel image 생성
- Meta Pixel 호출
- Google tag 호출
- Naver wcs 호출
- TikTok 호출

## 성공 기준

1. Google smoke에서 `has_gclid=true` 또는 `has_gbraid=true`, `gad_campaignid=14629255429`.
2. Naver smoke에서 `utm_source=naver_brand_search` 또는 `napm_present=true`.
3. `noSend=true`, `noVmWrite=true`, `noPixelRequest=true`.
4. Meta Pixel Helper에 새 Purchase 또는 PurchaseDecision 계열 중복 없음.
5. VM Cloud `payment_page_seen` row 0건.

## 다음 단계

이 후보는 GTM에 아직 만들지 않는다. 실제 Preview 실행은 [[imweb/coffee-payment-page-seen-debug-snapshot-approval-20260527]]의 Mode A 승인 후 진행한다.
