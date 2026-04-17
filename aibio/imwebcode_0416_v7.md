# AIBIO 아임웹 삽입 코드 v7

v7 변경점:

1. 폼 제출 직전 입력값을 브라우저에서만 확인한다.
2. 전화번호가 `010-0000-0000` 또는 `010-000-0000` 계열이면 테스트로 판정한다.
3. 이름 필드 값이 `테스트` 또는 `test`이면 테스트로 판정한다.
4. 이름/전화번호 원문과 해시는 전송하지 않는다.
5. 테스트 제출은 내부 원장에는 `metadata.is_test_contact=true`로 남기고, GTM에는 `aibio_form_submit_test` 이벤트를 보내서 GA4/Meta Lead 운영 전환 태그가 발화되지 않게 한다.

작성일: 2026-04-16
대상: `aibio.ai`
정본 GTM: `GTM-T8FLZNT`
정본 GA4: `G-PQWB91F4VQ`
정본 Meta Pixel: `1068377347547682`
Meta 광고계정: `act_377604674894011`

## ID 구분

Meta 광고계정 ID와 Meta Pixel ID는 다르다.

| 구분 | ID | 용도 |
|---|---|---|
| Meta 광고계정 ID | `377604674894011` 또는 API 표기 `act_377604674894011` | 광고비, 캠페인, 광고세트, 광고 성과를 조회하는 계정 |
| Meta Pixel ID | `1068377347547682` | 사이트에서 발생한 PageView, Lead, Purchase 같은 이벤트를 받는 데이터 소스 |

광고관리자에서 광고비를 볼 때는 광고계정 ID를 보고, Events Manager / Pixel Helper에서 이벤트를 볼 때는 Pixel ID를 본다.

## 이번 CSV 확인 결과

두 CSV 모두 이제 광고 레벨 ID는 들어왔다. 다만 아직 `웹사이트 URL`, `URL 매개변수` 컬럼은 없다.

| 파일 | 캠페인 | 광고 수 | 지출 | 링크 클릭 | 결과 | 결과 의미 |
|---|---|---:|---:|---:|---:|---|
| `AIBIO-...광고... (1).csv` | `리드 캠페인 (소재복사 0406_2352)` | 5 | ₩559,743 | 656 | 0 | 리드/웹사이트 리드 미집계 |
| `AIBIO-...광고....csv` | `26.01.16 리커버리랩 예약 캠페인` | 8 | ₩1,497,164 | 18,349 | 16,917 | 랜딩 페이지 조회 |

현재 광고 CSV만 보면 AIBIO는 “폼 제출 리드”가 아니라 “랜딩 페이지 조회” 기준으로 최적화/보고되고 있을 가능성이 높다.

## 삽입 전략

1. 헤더 상단에는 first-touch 저장 코드를 추가한다.
2. 기존 Meta Pixel, GTM, Google Ads 코드는 유지한다.
3. 푸터 코드는 기존 푸터 내용을 전부 지우고, 아래 `2. 푸터 코드 전체 교체본`을 그대로 붙여넣는다.
4. AIBIO는 구매 사이트가 아니므로 `Purchase` 이벤트 코드는 넣지 않는다.

주의: 기존 푸터에 있던 `payment-success` 결제 추적 코드는 이번 전체 교체본에서 제외했다. AIBIO의 현재 운영 기준 전환은 결제가 아니라 `입력폼 제출 리드`이기 때문이다. 나중에 AIBIO 자사몰 결제까지 ROAS에 넣어야 하면 별도 결제 추적 블록을 다시 추가한다.

---

## 1. 헤더코드 상단 추가

위치: 아임웹 `SEO/헤더코드 상단`의 가장 위.
목적: 광고 URL로 들어왔을 때 UTM, `fbclid`, `gclid`, `ttclid`, `_fbc`, `_fbp`를 먼저 저장한다.

```html
<!-- AIBIO first-touch capture v1 -->
<script>
(function () {
  var CONFIG = {
    source: 'aibio_imweb',
    snippetVersion: '2026-04-16-aibio-first-touch-v1',
    firstTouchKey: '_p1s1a_first_touch',
    lastTouchKey: '_p1s1a_last_touch',
    sessionTouchKey: '_p1s1a_session_touch'
  };

  function trim(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function readCookie(name) {
    var pattern = new RegExp('(?:^|; )' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)');
    var match = document.cookie.match(pattern);
    return match ? decodeURIComponent(match[1]) : '';
  }

  function safeParse(raw) {
    if (!raw) return {};
    try {
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  function readJson(key) {
    try {
      return safeParse(window.localStorage.getItem(key));
    } catch (error) {
      return {};
    }
  }

  function writeLocalJson(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {}
  }

  function writeSessionJson(key, value) {
    try {
      window.sessionStorage.setItem(key, JSON.stringify(value));
    } catch (error) {}
  }

  function captureTouch() {
    var params = new URLSearchParams(window.location.search);
    var touch = {
      source: CONFIG.source,
      snippetVersion: CONFIG.snippetVersion,
      capturedAt: new Date().toISOString(),
      landing: window.location.href,
      path: window.location.pathname + window.location.search,
      referrer: document.referrer || '',
      utm_source: trim(params.get('utm_source')),
      utm_medium: trim(params.get('utm_medium')),
      utm_campaign: trim(params.get('utm_campaign')),
      utm_content: trim(params.get('utm_content')),
      utm_term: trim(params.get('utm_term')),
      gclid: trim(params.get('gclid')),
      fbclid: trim(params.get('fbclid')),
      ttclid: trim(params.get('ttclid')),
      fbc: readCookie('_fbc'),
      fbp: readCookie('_fbp')
    };

    var hasClickSignal =
      touch.utm_source ||
      touch.utm_medium ||
      touch.utm_campaign ||
      touch.utm_content ||
      touch.utm_term ||
      touch.gclid ||
      touch.fbclid ||
      touch.ttclid ||
      touch.fbc;

    writeSessionJson(CONFIG.sessionTouchKey, touch);

    if (!readJson(CONFIG.firstTouchKey).capturedAt) {
      writeLocalJson(CONFIG.firstTouchKey, touch);
    }

    if (hasClickSignal || !readJson(CONFIG.lastTouchKey).capturedAt) {
      writeLocalJson(CONFIG.lastTouchKey, touch);
    }

    window.__AIBIO_TOUCH_CAPTURED__ = {
      snippetVersion: CONFIG.snippetVersion,
      hasClickSignal: Boolean(hasClickSignal),
      touch: touch
    };
  }

  captureTouch();
  setTimeout(captureTouch, 800);
  setTimeout(captureTouch, 2500);
})();
</script>
```

---

## 2. 푸터 코드 전체 교체본

위치: 아임웹 `푸터 코드`.
작업 방식: 기존 아임웹 푸터 코드 내용을 전부 삭제하고, 아래 코드 블록 전체를 그대로 붙여넣는다.
포함 기능: AIBIO 입력폼 제출을 자체 원장 `/api/attribution/form-submit`으로 전송한다.
제외 기능: 결제완료 `payment-success` 추적은 이번 리드 분석 목적과 달라서 제외한다.

```html
<!-- AIBIO form-submit attribution v7 -->
<script>
(function () {
  var CONFIG = {
    endpoint: 'https://att.ainativeos.net/api/attribution/form-submit',
    source: 'aibio_imweb',
    measurementIds: ['G-PQWB91F4VQ'],
    requestTimeoutMs: 1000,
    debugQueryKey: '__seo_attribution_debug',
    dedupeKeyPrefix: '__seo_form_submit_sent__:',
    snippetVersion: '2026-04-16-aibio-form-submit-v7',
    logPrefix: '[aibio-form-submit-v7]',
    firstTouchKey: '_p1s1a_first_touch',
    lastTouchKey: '_p1s1a_last_touch',
    sessionTouchKey: '_p1s1a_session_touch'
  };

  var pendingSubmit = null;
  var inFlightSubmitKeys = {};
  var recentHandledWidgets = {};
  var clickHookInstalled = false;
  var confirmHookAttempts = 0;
  var successModalPollTimer = null;

  function trim(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function firstNonEmpty(values) {
    for (var i = 0; i < values.length; i += 1) {
      var value = trim(values[i]);
      if (value) return value;
    }
    return '';
  }

  function safeParse(raw) {
    if (!raw) return {};
    try {
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  function readJsonStorage(storage, key) {
    try {
      if (!storage) return {};
      return safeParse(storage.getItem(key));
    } catch (error) {
      return {};
    }
  }

  function readCookie(name) {
    var pattern = new RegExp('(?:^|; )' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)');
    var match = document.cookie.match(pattern);
    return match ? decodeURIComponent(match[1]) : '';
  }

  function readDataLayerValue(keys) {
    if (!Array.isArray(window.dataLayer)) return '';
    for (var i = window.dataLayer.length - 1; i >= 0; i -= 1) {
      var item = window.dataLayer[i];
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      for (var j = 0; j < keys.length; j += 1) {
        var key = keys[j];
        var value = trim(item[key]);
        if (value) return value;
      }
    }
    return '';
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

  function getGtagValue(fieldName) {
    return new Promise(function (resolve) {
      if (typeof window.gtag !== 'function' || !CONFIG.measurementIds.length) {
        resolve('');
        return;
      }

      var settled = false;
      var pending = CONFIG.measurementIds.length;
      var timer = setTimeout(function () {
        if (!settled) {
          settled = true;
          resolve('');
        }
      }, CONFIG.requestTimeoutMs);

      function finish(value) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(trim(value));
      }

      function markPendingDone() {
        pending -= 1;
        if (pending <= 0) finish('');
      }

      CONFIG.measurementIds.forEach(function (measurementId) {
        try {
          window.gtag('get', measurementId, fieldName, function (value) {
            var normalized = trim(value);
            if (normalized) {
              finish(normalized);
              return;
            }
            markPendingDone();
          });
        } catch (error) {
          markPendingDone();
        }
      });
    });
  }

  function getSearchParam(keys) {
    var params = new URLSearchParams(location.search);
    for (var i = 0; i < keys.length; i += 1) {
      var value = trim(params.get(keys[i]));
      if (value) return value;
    }
    return '';
  }

  function mergeLandingParams(base, urlLike) {
    try {
      if (!urlLike) return base;
      var params = new URL(urlLike).searchParams;
      return {
        utm_source: firstNonEmpty([base.utm_source, params.get('utm_source')]),
        utm_medium: firstNonEmpty([base.utm_medium, params.get('utm_medium')]),
        utm_campaign: firstNonEmpty([base.utm_campaign, params.get('utm_campaign')]),
        utm_content: firstNonEmpty([base.utm_content, params.get('utm_content')]),
        utm_term: firstNonEmpty([base.utm_term, params.get('utm_term')]),
        gclid: firstNonEmpty([base.gclid, params.get('gclid')]),
        fbclid: firstNonEmpty([base.fbclid, params.get('fbclid')]),
        ttclid: firstNonEmpty([base.ttclid, params.get('ttclid')]),
        fbc: firstNonEmpty([base.fbc, params.get('fbc')]),
        fbp: firstNonEmpty([base.fbp, params.get('fbp')])
      };
    } catch (error) {
      return base;
    }
  }

  function hasSentMarker(key) {
    try {
      return Boolean(window.sessionStorage && window.sessionStorage.getItem(key));
    } catch (error) {
      return false;
    }
  }

  function rememberSent(key) {
    try {
      if (!window.sessionStorage) return;
      window.sessionStorage.setItem(key, new Date().toISOString());
    } catch (error) {}
  }

  function hasInFlightMarker(key) {
    return Boolean(key && inFlightSubmitKeys[key]);
  }

  function rememberInFlight(key) {
    if (!key) return;
    inFlightSubmitKeys[key] = true;
  }

  function clearInFlight(key) {
    if (!key) return;
    delete inFlightSubmitKeys[key];
  }

  function wasRecentlyHandled(widgetId, now) {
    var key = trim(widgetId);
    if (!key) return false;
    var previous = recentHandledWidgets[key];
    return Boolean(previous && now - previous < 10000);
  }

  function rememberHandledWidget(widgetId, now) {
    var key = trim(widgetId);
    if (!key) return;
    recentHandledWidgets[key] = now;
  }

  function isDebugMode() {
    return new URLSearchParams(location.search).get(CONFIG.debugQueryKey) === '1';
  }

  function debugLog() {
    if (!isDebugMode()) return;
    try {
      console.log.apply(console, [CONFIG.logPrefix].concat([].slice.call(arguments)));
    } catch (error) {}
  }

  function sendPayload(payload) {
    return fetch(CONFIG.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
      credentials: 'omit',
      mode: 'cors'
    }).then(function (response) {
      if (!response.ok) {
        throw new Error('form-submit failed with ' + response.status);
      }
      return { sentBy: 'fetch', accepted: true, status: response.status };
    });
  }

  function getWidgetIdFromOnclick(node) {
    if (!node || typeof node.getAttribute !== 'function') return '';
    var onclick = trim(node.getAttribute('onclick'));
    if (!onclick) return '';
    var match = onclick.match(/confirmInputForm\('([^']+)'/);
    return match ? trim(match[1]) : '';
  }

  function normalizeDigits(value) {
    return trim(value).replace(/\D/g, '');
  }

  function normalizeTestName(value) {
    return trim(value).replace(/\s/g, '').toLowerCase();
  }

  function isTestPhone(value) {
    var digits = normalizeDigits(value);
    return digits === '0100000000' || digits === '01000000000';
  }

  function isTestName(value) {
    var normalized = normalizeTestName(value);
    return normalized === '테스트' || normalized === 'test';
  }

  function nodeText(node) {
    if (!node) return '';
    return trim(node.textContent || node.innerText || '');
  }

  function getFieldHint(input) {
    if (!input) return '';
    var hints = [
      input.getAttribute('name'),
      input.getAttribute('id'),
      input.getAttribute('class'),
      input.getAttribute('placeholder'),
      input.getAttribute('aria-label'),
      input.getAttribute('title'),
      input.getAttribute('data-name'),
      input.getAttribute('data-label')
    ];

    if (input.id) {
      var label = querySelectorSafe('label[for="' + input.id.replace(/"/g, '\\"') + '"]');
      hints.push(nodeText(label));
    }

    var group = input.closest ? input.closest('.form-group, .input_block, .input_form, .control-group, li, tr, .doz-form-group') : null;
    if (group) hints.push(nodeText(group).slice(0, 120));

    return hints.map(trim).filter(Boolean).join(' ').toLowerCase();
  }

  function isNameFieldHint(hint) {
    return hint.indexOf('이름') >= 0 ||
      hint.indexOf('성함') >= 0 ||
      hint.indexOf('name') >= 0 ||
      hint.indexOf('customer_name') >= 0 ||
      hint.indexOf('buyer_name') >= 0;
  }

  function isSkippableInput(input) {
    var type = trim(input && input.getAttribute ? input.getAttribute('type') : '').toLowerCase();
    return type === 'hidden' ||
      type === 'password' ||
      type === 'submit' ||
      type === 'button' ||
      type === 'file' ||
      type === 'checkbox' ||
      type === 'radio';
  }

  function addUniqueNode(nodes, node) {
    if (!node) return;
    for (var i = 0; i < nodes.length; i += 1) {
      if (nodes[i] === node) return;
    }
    nodes.push(node);
  }

  function querySelectorSafe(selector) {
    try {
      return document.querySelector(selector);
    } catch (error) {
      return null;
    }
  }

  function querySelectorAllSafe(selector) {
    try {
      return [].slice.call(document.querySelectorAll(selector));
    } catch (error) {
      return [];
    }
  }

  function getCandidateFormRoots(widgetId, submitButton) {
    var roots = [];
    if (submitButton && submitButton.closest) {
      addUniqueNode(roots, submitButton.closest('form'));
      addUniqueNode(roots, submitButton.closest('.input_form'));
      addUniqueNode(roots, submitButton.closest('.form-widget'));
      addUniqueNode(roots, submitButton.closest('[id]'));
      addUniqueNode(roots, submitButton.parentElement);
    }

    var widget = trim(widgetId);
    if (widget) {
      addUniqueNode(roots, document.getElementById(widget));
      addUniqueNode(roots, document.getElementById('input_form_' + widget));
      addUniqueNode(roots, querySelectorSafe('[data-widget-id="' + widget.replace(/"/g, '\\"') + '"]'));
      var widgetMatches = querySelectorAllSafe('[id*="' + widget.replace(/"/g, '\\"') + '"], [class*="' + widget.replace(/"/g, '\\"') + '"]');
      for (var i = 0; i < widgetMatches.length; i += 1) {
        addUniqueNode(roots, widgetMatches[i]);
      }
    }

    return roots.filter(function (root) {
      return root && typeof root.querySelectorAll === 'function';
    });
  }

  function collectTestContactInfo(widgetId, submitButton) {
    var roots = getCandidateFormRoots(widgetId, submitButton);
    for (var r = 0; r < roots.length; r += 1) {
      var inputs = roots[r].querySelectorAll('input, textarea');
      for (var i = 0; i < inputs.length; i += 1) {
        var input = inputs[i];
        if (isSkippableInput(input)) continue;
        var value = trim(input.value);
        if (!value) continue;
        var hint = getFieldHint(input);
        if (isTestPhone(value)) {
          return {
            isTestContact: true,
            reason: 'phone_zero',
            matchedField: hint.indexOf('phone') >= 0 || hint.indexOf('전화') >= 0 || hint.indexOf('연락') >= 0 ? 'phone' : 'unknown_phone_like'
          };
        }
        if (isNameFieldHint(hint) && isTestName(value)) {
          return {
            isTestContact: true,
            reason: 'name_test',
            matchedField: 'name'
          };
        }
      }
    }

    return {
      isTestContact: false,
      reason: '',
      matchedField: ''
    };
  }

  function rememberPendingSubmit(widgetId, triggerType, submitButton) {
    var normalizedWidgetId = trim(widgetId);
    var now = Date.now();
    var previous = pendingSubmit &&
      now - pendingSubmit.triggeredAt < 1000 &&
      (!normalizedWidgetId || !pendingSubmit.widgetId || pendingSubmit.widgetId === normalizedWidgetId)
      ? pendingSubmit
      : null;
    var resolvedSubmitButton = submitButton || (previous ? previous.submitButton : null);
    var testContact = collectTestContactInfo(normalizedWidgetId, resolvedSubmitButton);
    if (!testContact.isTestContact && previous && previous.testContact && previous.testContact.isTestContact) {
      testContact = previous.testContact;
    }
    pendingSubmit = {
      widgetId: normalizedWidgetId,
      triggerType: trim(triggerType),
      triggeredAt: now,
      submitButton: resolvedSubmitButton,
      testContact: testContact
    };
    debugLog('pending_submit', {
      widgetId: pendingSubmit.widgetId,
      triggerType: pendingSubmit.triggerType,
      triggeredAt: pendingSubmit.triggeredAt,
      testContact: testContact
    });
    schedulePendingSubmitModalPoll();
  }

  function buildFormId(widgetId, triggeredAt) {
    return [location.pathname || '/', trim(widgetId) || 'unknown_widget', String(triggeredAt || Date.now())].join('_');
  }

  function pushDataLayer(formPage, formId, widgetId, testContact) {
    var isTestContact = Boolean(testContact && testContact.isTestContact);
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: isTestContact ? 'aibio_form_submit_test' : 'aibio_form_submit',
      formPage: formPage,
      formId: formId,
      formWidgetId: trim(widgetId),
      snippetVersion: CONFIG.snippetVersion,
      isTestContact: isTestContact,
      testContactReason: isTestContact ? trim(testContact.reason) : ''
    });
  }

  function collectTracking(imwebSession, firstTouch, lastTouch, sessionTouch, landing) {
    return mergeLandingParams({
      utm_source: firstNonEmpty([trim(imwebSession.utmSource), trim(lastTouch.utm_source), trim(firstTouch.utm_source), trim(sessionTouch.utm_source), getSearchParam(['utm_source'])]),
      utm_medium: firstNonEmpty([trim(imwebSession.utmMedium), trim(lastTouch.utm_medium), trim(firstTouch.utm_medium), trim(sessionTouch.utm_medium), getSearchParam(['utm_medium'])]),
      utm_campaign: firstNonEmpty([trim(imwebSession.utmCampaign), trim(lastTouch.utm_campaign), trim(firstTouch.utm_campaign), trim(sessionTouch.utm_campaign), getSearchParam(['utm_campaign'])]),
      utm_content: firstNonEmpty([trim(imwebSession.utmContent), trim(lastTouch.utm_content), trim(firstTouch.utm_content), trim(sessionTouch.utm_content), getSearchParam(['utm_content'])]),
      utm_term: firstNonEmpty([trim(imwebSession.utmTerm), trim(lastTouch.utm_term), trim(firstTouch.utm_term), trim(sessionTouch.utm_term), getSearchParam(['utm_term'])]),
      gclid: firstNonEmpty([trim(lastTouch.gclid), trim(firstTouch.gclid), trim(sessionTouch.gclid), getSearchParam(['gclid'])]),
      fbclid: firstNonEmpty([trim(lastTouch.fbclid), trim(firstTouch.fbclid), trim(sessionTouch.fbclid), getSearchParam(['fbclid'])]),
      ttclid: firstNonEmpty([trim(lastTouch.ttclid), trim(firstTouch.ttclid), trim(sessionTouch.ttclid), getSearchParam(['ttclid'])]),
      fbc: firstNonEmpty([trim(lastTouch.fbc), trim(firstTouch.fbc), trim(sessionTouch.fbc), readCookie('_fbc'), getSearchParam(['fbc'])]),
      fbp: firstNonEmpty([trim(lastTouch.fbp), trim(firstTouch.fbp), trim(sessionTouch.fbp), readCookie('_fbp'), getSearchParam(['fbp'])])
    }, landing);
  }

  function sendFormSubmit(widgetId, triggeredAt, triggerType, submitButton, testContactHint) {
    var imwebSession = readJsonStorage(window.sessionStorage, '__bs_imweb_session');
    var firstTouch = readJsonStorage(window.localStorage, CONFIG.firstTouchKey);
    var lastTouch = readJsonStorage(window.localStorage, CONFIG.lastTouchKey);
    var sessionTouch = readJsonStorage(window.sessionStorage, CONFIG.sessionTouchKey);
    var formPage = location.pathname || '/';
    var formId = buildFormId(widgetId, triggeredAt);
    var dedupeKey = CONFIG.dedupeKeyPrefix + formId;

    if (hasSentMarker(dedupeKey) || hasInFlightMarker(dedupeKey)) {
      debugLog('skip_duplicate', dedupeKey);
      return;
    }

    var testContact = testContactHint && typeof testContactHint === 'object'
      ? testContactHint
      : collectTestContactInfo(widgetId, submitButton || null);

    rememberInFlight(dedupeKey);
    pushDataLayer(formPage, formId, widgetId, testContact);

    var landing = firstNonEmpty([
      trim(imwebSession.utmLandingUrl),
      trim(lastTouch.landing),
      trim(firstTouch.landing),
      trim(sessionTouch.landing),
      location.href
    ]);
    var tracking = collectTracking(imwebSession, firstTouch, lastTouch, sessionTouch, landing);

    Promise.all([
      Promise.resolve(firstNonEmpty([
        readDataLayerValue(['ga_session_id', 'gaSessionId']),
        trim(lastTouch.ga_session_id),
        trim(firstTouch.ga_session_id),
        trim(sessionTouch.ga_session_id),
        trim(imwebSession.ga_session_id)
      ])).then(function (value) {
        if (value) return value;
        return getGtagValue('session_id').then(function (gtagValue) {
          if (gtagValue) return gtagValue;
          for (var i = 0; i < CONFIG.measurementIds.length; i += 1) {
            var parsed = parseSessionIdFromGaCookie(readCookie(getMeasurementCookieName(CONFIG.measurementIds[i])));
            if (parsed) return parsed;
          }
          return '';
        });
      }),
      Promise.resolve(firstNonEmpty([
        readDataLayerValue(['client_id', 'clientId', 'ga_client_id', 'gaClientId']),
        trim(lastTouch.client_id),
        trim(firstTouch.client_id),
        trim(sessionTouch.client_id),
        trim(imwebSession.client_id)
      ])).then(function (value) {
        if (value) return value;
        return getGtagValue('client_id').then(function (gtagValue) {
          if (gtagValue) return gtagValue;
          return parseClientIdFromGaCookie(readCookie('_ga'));
        });
      })
    ]).then(function (identity) {
      var gaSessionId = trim(identity[0]);
      var clientId = trim(identity[1]);
      var userPseudoId = firstNonEmpty([
        readDataLayerValue(['user_pseudo_id', 'userPseudoId', 'ga_user_pseudo_id', 'gaUserPseudoId']),
        trim(lastTouch.user_pseudo_id),
        trim(firstTouch.user_pseudo_id),
        trim(sessionTouch.user_pseudo_id),
        trim(imwebSession.user_pseudo_id),
        clientId
      ]);

      var payload = {
        touchpoint: 'form_submit',
        captureMode: 'live',
        source: CONFIG.source,
        clientObservedAt: new Date().toISOString(),
        formId: formId,
        formName: 'form',
        formPage: formPage,
        referrer: location.href,
        landing: landing,
        ga_session_id: gaSessionId,
        client_id: clientId,
        user_pseudo_id: userPseudoId,
        utm_source: tracking.utm_source,
        utm_medium: tracking.utm_medium,
        utm_campaign: tracking.utm_campaign,
        utm_content: tracking.utm_content,
        utm_term: tracking.utm_term,
        gclid: tracking.gclid,
        fbclid: tracking.fbclid,
        ttclid: tracking.ttclid,
        fbc: tracking.fbc,
        fbp: tracking.fbp,
        metadata: {
          source: CONFIG.source,
          snippetVersion: CONFIG.snippetVersion,
          ga_measurement_ids: CONFIG.measurementIds,
          imweb_landing_url: trim(imwebSession.utmLandingUrl),
          initial_referrer: firstNonEmpty([trim(imwebSession.initialReferrer), trim(lastTouch.referrer), trim(firstTouch.referrer), document.referrer || '']),
          original_referrer: firstNonEmpty([trim(imwebSession.initialReferrer), trim(lastTouch.referrer), trim(firstTouch.referrer), document.referrer || '']),
          formId: formId,
          formName: 'form',
          formPage: formPage,
          form_widget_id: trim(widgetId),
          form_trigger_type: trim(triggerType),
          clientId: clientId,
          userPseudoId: userPseudoId,
          gaSessionId: gaSessionId,
          fbc: tracking.fbc,
          fbp: tracking.fbp,
          first_touch: firstTouch,
          last_touch: lastTouch,
          session_touch: sessionTouch,
          is_debug: isDebugMode(),
          is_test_contact: Boolean(testContact && testContact.isTestContact),
          test_contact_reason: testContact && testContact.isTestContact ? trim(testContact.reason) : '',
          test_contact_matched_field: testContact && testContact.isTestContact ? trim(testContact.matchedField) : '',
          user_pseudo_id_strategy: userPseudoId && userPseudoId === clientId ? 'client_id_fallback' : 'explicit_value'
        }
      };

      debugLog('send_payload', payload);
      return sendPayload(payload).then(function (result) {
        rememberSent(dedupeKey);
        clearInFlight(dedupeKey);
        debugLog('send_ok', result);
        return result;
      }).catch(function (error) {
        clearInFlight(dedupeKey);
        debugLog('send_failed', error && error.message ? error.message : error);
      });
    });
  }

  function installClickHook() {
    if (clickHookInstalled) return;
    clickHookInstalled = true;
    document.addEventListener('click', function (event) {
      var target = event.target && event.target.closest ? event.target.closest('._input_form_submit') : null;
      if (!target) return;
      rememberPendingSubmit(getWidgetIdFromOnclick(target), 'click', target);
    }, true);
  }

  function installConfirmHook() {
    if (!window.SITE_FORM || typeof window.SITE_FORM.confirmInputForm !== 'function') {
      return false;
    }
    if (window.SITE_FORM.confirmInputForm.__seoWrapped) {
      return true;
    }

    var original = window.SITE_FORM.confirmInputForm;
    var wrapped = function () {
      rememberPendingSubmit(arguments[0], 'confirmInputForm', null);
      return original.apply(this, arguments);
    };

    wrapped.__seoWrapped = true;
    window.SITE_FORM.confirmInputForm = wrapped;
    return true;
  }

  function scheduleConfirmHookInstall() {
    if (installConfirmHook()) return;
    var timer = setInterval(function () {
      confirmHookAttempts += 1;
      if (installConfirmHook() || confirmHookAttempts >= 100) {
        clearInterval(timer);
      }
    }, 200);
  }

  function modalWidgetId(modal) {
    if (!modal || !modal.id) return '';
    return trim(modal.id.replace(/^input_form_complete_modal_/, ''));
  }

  function getSuccessModal(widgetId) {
    if (!widgetId || !document.getElementById) return null;
    return document.getElementById('input_form_complete_modal_' + trim(widgetId));
  }

  function isVisibleSuccessModal(modal) {
    if (!modal || !modal.id || modal.id.indexOf('input_form_complete_modal_') !== 0) return false;
    if (modal.getAttribute('aria-hidden') === 'true') return false;
    if (modal.style && modal.style.display === 'none') return false;
    return true;
  }

  function handleSuccessModal(modal) {
    var widgetId = modalWidgetId(modal);
    var now = Date.now();
    if (wasRecentlyHandled(widgetId, now)) {
      debugLog('skip_recent_handled_widget', widgetId);
      return;
    }
    var pendingMatches = pendingSubmit && now - pendingSubmit.triggeredAt < 60000 && (!pendingSubmit.widgetId || pendingSubmit.widgetId === widgetId);
    var triggeredAt = pendingMatches ? pendingSubmit.triggeredAt : now;
    var triggerType = pendingMatches ? pendingSubmit.triggerType : 'success_modal';
    var submitButton = pendingMatches ? pendingSubmit.submitButton : null;
    var testContact = pendingMatches ? pendingSubmit.testContact : null;
    if (successModalPollTimer) {
      clearInterval(successModalPollTimer);
      successModalPollTimer = null;
    }
    rememberHandledWidget(widgetId, now);
    sendFormSubmit(widgetId, triggeredAt, triggerType, submitButton, testContact);
    if (pendingMatches) {
      pendingSubmit = null;
    }
  }

  function schedulePendingSubmitModalPoll() {
    if (!pendingSubmit || !pendingSubmit.widgetId) return;
    if (successModalPollTimer) {
      clearInterval(successModalPollTimer);
      successModalPollTimer = null;
    }

    var attempts = 0;
    successModalPollTimer = setInterval(function () {
      attempts += 1;
      if (!pendingSubmit || attempts >= 80) {
        clearInterval(successModalPollTimer);
        successModalPollTimer = null;
        return;
      }

      var modal = getSuccessModal(pendingSubmit.widgetId);
      if (isVisibleSuccessModal(modal)) {
        clearInterval(successModalPollTimer);
        successModalPollTimer = null;
        handleSuccessModal(modal);
      }
    }, 250);
  }

  function watchSuccessModals() {
    if (!window.MutationObserver || !document.body) return;

    new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        if (isVisibleSuccessModal(mutation.target)) {
          handleSuccessModal(mutation.target);
        }
      });
    }).observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class', 'aria-hidden']
    });
  }

  installClickHook();
  scheduleConfirmHookInstall();
  watchSuccessModals();

  window.__AIBIO_FORM_SUBMIT_V7__ = {
    snippetVersion: CONFIG.snippetVersion,
    source: CONFIG.source
  };
})();
</script>
```

## 삽입 후 테스트 방법

일반 URL로 접속해서 테스트 연락처로 폼을 1건 제출한다. URL에 `__seo_attribution_debug=1`을 붙일 필요는 없다.

```text
https://aibio.ai/59
```

입력 예시:

```text
이름: 테스트
전화번호: 010-0000-0000
```

확인할 것:

- 원장 row metadata에 `snippetVersion=2026-04-16-aibio-form-submit-v7`, `is_test_contact=true`, `test_contact_reason`이 들어오는지
- GTM Preview에서 테스트 제출은 `aibio_form_submit_test`로 보이고, `aibio_form_submit` 운영 트리거는 발화하지 않는지
- `/acquisition-analysis`에서 AIBIO 테스트 제출이 운영 분석에서 제외되는지
- 일반 고객 제출은 `aibio_form_submit`으로 유지되는지
