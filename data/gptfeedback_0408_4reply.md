# 0408 피드백 4차 반영 결과

## 1. 10초 요약

- 이번 턴에서 **끝난 일**은 “바이오컴 결제완료 페이지에 붙일 코드”를 준비한 것이오.
- 바이오컴 실제 사이트에는 **기존 푸터/커스텀 코드가 이미 있고**, 우리가 만든 새 attribution 스니펫만 아직 붙지 않았소. 그래서 지금 서버에 들어오는 결제 데이터는 아직 예전 방식 그대로이고, `ga_session_id / client_id / user_pseudo_id`도 여전히 `0%`요.

## 2. 지금 상태를 한 문장으로 설명하면

**새 코드는 만들었지만, 기존 라이브 푸터 코드에 아직 병합·배포하지 않았소.**  
고정 endpoint는 `https://att.ainativeos.net/api/attribution/payment-success`로 확인됐지만, 현재 상태는 여전히 “준비는 끝났고 publish는 아직”이오.

## 3. 이번 턴에 실제로 끝난 것 3개

- **바이오컴용 결제완료 스크립트를 만들었소.**  
  이전에는 저장소 안에 실제로 붙여 넣을 caller 코드가 없었소.  
  이제 [biocom_payment_success_caller.html](/Users/vibetj/coding/seo/imweb/biocom_payment_success_caller.html)에 바이오컴 결제완료 페이지용 정본 스크립트가 있소.

- **GA 식별자 3종을 같이 보내는 로직을 넣었소.**  
  이 스크립트는 `ga_session_id`, `client_id`, `user_pseudo_id`를 읽어서 `payment_success` payload에 같이 담도록 만들었소.  
  즉 “결제는 잡히는데 GA 연결이 안 되는 문제”를 해결하기 위한 코드 준비는 끝났소.

- **설치 문서와 검증 코드도 같이 만들었소.**  
  [payment_success_install.md](/Users/vibetj/coding/seo/imweb/payment_success_install.md)에 어디에 넣는지, 고정 endpoint가 무엇인지, `ngrok` 없이 운영 가능한지, 적용 후 뭘 확인해야 하는지를 적었고,  
  [imwebAttributionSnippet.ts](/Users/vibetj/coding/seo/backend/src/imwebAttributionSnippet.ts), [render-imweb-attribution-snippet.ts](/Users/vibetj/coding/seo/backend/scripts/render-imweb-attribution-snippet.ts), [imweb-attribution-snippet.test.ts](/Users/vibetj/coding/seo/backend/tests/imweb-attribution-snippet.test.ts)로 코드 생성과 테스트까지 붙였소.

## 4. 아직 안 끝난 것 3개

- **실제 사이트 반영은 아직 안 했소.**  
  이유는 caller 코드가 이 저장소 안이 아니라 **바이오컴 아임웹 관리자 화면의 기존 푸터/커스텀 코드**에 병합돼야 하기 때문이오.  
  즉 이번 턴은 “붙일 코드 준비 + 고정 endpoint 확인”까지이고, “운영 사이트에 실제 publish”는 아직 안 된 상태요.

- **그래서 현재 숫자는 아직 안 바뀌었소.**  
  최신 코드 기준으로 확인해도 live `payment_success 517건`에서  
  `ga_session_id 0% / client_id 0% / user_pseudo_id 0%` 그대로요.  
  이건 코드가 틀렸다는 뜻이 아니라, **아직 운영 사이트에 새 코드가 안 올라갔다는 뜻**이오.

- **checkout 시작 지점 추적은 이번 턴에 안 했소.**  
  이번에는 `payment_success`에 집중했소.  
  `checkout-context`까지 붙이려면 아임웹/GTM 쪽 실제 begin_checkout 지점을 더 확인해야 하오.

## 5. 대표가 지금 보면 되는 판단 포인트

- **지금 바로 할 일은 개발이 아니라 운영 반영이오.**  
  [biocom_payment_success_caller.html](/Users/vibetj/coding/seo/imweb/biocom_payment_success_caller.html)을 바이오컴 아임웹의 **기존 푸터 코드에 병합**하고 배포해야 하오. 고정 endpoint는 이미 `att.ainativeos.net` 기준으로 정리했소.

- **배포 후 바로 확인할 숫자는 하나요.**  
  `ga_session_id / client_id / user_pseudo_id`가 `0%`에서 벗어나는지 보면 되오.  
  그때부터 “준비 완료”가 아니라 “실제 적용 완료”라고 말할 수 있소.

## 6. 핵심 숫자

- live `payment_success`: `517건`
- source 분포: `biocom_imweb 452 / thecleancoffee_imweb 58 / aibio_imweb 1`
- 현재 coverage: `ga_session_id 0% / client_id 0% / user_pseudo_id 0%`
- 자동 검증: `typecheck 통과 + snippet test 2개 통과`
- 상태 해석: **결제 row는 들어오고 있지만, GA 식별자는 아직 실제 유입되지 않음**

## 7. 부록

### 푸터에 바로 붙여넣을 코드

먼저 사실관계부터 적겠소.

- `/Users/vibetj/coding/seo/imweb/biocom_payment_success_caller.html` 파일은 **비어 있지 않소**.
- 현재 제 로컬 기준 파일 크기는 `11,533 bytes`요.
- 그래서 실제로 푸터에 붙일 코드는 이미 준비돼 있고, 아래 블록을 **기존 푸터 코드 아래에 추가**하면 되오.

#### 적용 원칙

1. **1차 적용은 기존 푸터 코드를 그대로 두고, 아래 `<script>` 블록만 맨 아래에 추가**하면 되오.
2. 다만 기존 푸터 안에 이미 `fetch(...)`, `sendBeacon(...)`, 또는 `POST /api/attribution/payment-success`로 보내는 **예전 payment-success 발송 코드가 있으면**, 최종적으로는 그 블록을 제거하거나 새 블록으로 교체해야 중복 적재를 막을 수 있소.
3. 현재 저장소에서 확인한 근거상, 라이브 HTML에는 `shop_payment_complete / shop_order_done` 감지 조건은 있었지만, 새 attribution endpoint 문자열과 `ga_session_id / client_id / user_pseudo_id`는 안 보였소. 그래서 **우선은 “기존 코드 유지 + 아래 블록 추가”가 맞는 1차 적용안**이오.
4. 배포 후 Network 탭에서 `https://att.ainativeos.net/api/attribution/payment-success`가 **한 번만** 나가는지 꼭 확인하시오. 두 번 나가면 기존 sender 블록을 제거해야 하오.

#### 그대로 붙여넣을 코드

```html
<!-- Fixed attribution endpoint confirmed 2026-04-08: https://att.ainativeos.net -->
<script>
(function () {
  var CONFIG = {
    endpoint: 'https://att.ainativeos.net/api/attribution/payment-success',
    source: 'biocom_imweb',
    measurementIds: ["G-WJFXN5E2Q1","G-8GZ48B1S59"],
    requestTimeoutMs: 800,
    debugQueryKey: '__seo_attribution_debug',
    dedupeKeyPrefix: '__seo_payment_success_sent__:'
  };

  if (location.href.indexOf('shop_payment_complete') < 0 && location.href.indexOf('shop_order_done') < 0) return;

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

  function getOrderIdFromDom() {
    var selectors = [
      '[data-order-no]',
      '[data-order]',
      '[class*="order-number"]',
      '[class*="order_no"]'
    ];

    for (var i = 0; i < selectors.length; i += 1) {
      var node = document.querySelector(selectors[i]);
      if (!node) continue;
      var value = firstNonEmpty([
        node.getAttribute && node.getAttribute('data-order-no'),
        node.getAttribute && node.getAttribute('data-order'),
        node.textContent
      ]);
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
        ttclid: firstNonEmpty([base.ttclid, params.get('ttclid')])
      };
    } catch (error) {
      return base;
    }
  }

  function markSentOnce(key) {
    try {
      if (!window.sessionStorage) return false;
      if (window.sessionStorage.getItem(key)) return true;
      window.sessionStorage.setItem(key, new Date().toISOString());
      return false;
    } catch (error) {
      return false;
    }
  }

  function isDebugMode() {
    return new URLSearchParams(location.search).get(CONFIG.debugQueryKey) === '1';
  }

  function debugLog() {
    if (!isDebugMode()) return;
    try {
      console.log.apply(console, ['[seo-attribution]'].concat([].slice.call(arguments)));
    } catch (error) {}
  }

  function sendPayload(payload) {
    var body = JSON.stringify(payload);
    if (navigator.sendBeacon && typeof Blob === 'function') {
      var ok = navigator.sendBeacon(CONFIG.endpoint, new Blob([body], { type: 'application/json' }));
      if (ok) return Promise.resolve({ sentBy: 'beacon' });
    }

    return fetch(CONFIG.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body,
      keepalive: true,
      credentials: 'omit',
      mode: 'cors'
    }).then(function () {
      return { sentBy: 'fetch' };
    });
  }

  var imwebSession = readJsonStorage(window.sessionStorage, '__bs_imweb_session');
  var lastTouch = readJsonStorage(window.localStorage, '_p1s1a_last_touch');
  var orderId = firstNonEmpty([
    getSearchParam(['order_no', 'orderId', 'order_id']),
    trim(imwebSession.order_no),
    trim(lastTouch.orderId),
    getOrderIdFromDom()
  ]);
  var paymentKey = firstNonEmpty([
    getSearchParam(['paymentKey', 'payment_key']),
    trim(lastTouch.paymentKey)
  ]);
  var landing = firstNonEmpty([trim(imwebSession.utmLandingUrl), trim(lastTouch.landing), location.pathname]);
  var tracking = mergeLandingParams({
    utm_source: firstNonEmpty([trim(imwebSession.utmSource), trim(lastTouch.utm_source), getSearchParam(['utm_source'])]),
    utm_medium: firstNonEmpty([trim(imwebSession.utmMedium), trim(lastTouch.utm_medium), getSearchParam(['utm_medium'])]),
    utm_campaign: firstNonEmpty([trim(imwebSession.utmCampaign), trim(lastTouch.utm_campaign), getSearchParam(['utm_campaign'])]),
    utm_content: firstNonEmpty([trim(imwebSession.utmContent), trim(lastTouch.utm_content), getSearchParam(['utm_content'])]),
    utm_term: firstNonEmpty([trim(imwebSession.utmTerm), trim(lastTouch.utm_term), getSearchParam(['utm_term'])]),
    gclid: firstNonEmpty([trim(lastTouch.gclid), getSearchParam(['gclid'])]),
    fbclid: firstNonEmpty([trim(lastTouch.fbclid), getSearchParam(['fbclid'])]),
    ttclid: firstNonEmpty([trim(lastTouch.ttclid), getSearchParam(['ttclid'])])
  }, landing);

  var dedupeKey = CONFIG.dedupeKeyPrefix + firstNonEmpty([orderId, paymentKey, location.pathname + '::' + document.referrer]);
  if (dedupeKey && markSentOnce(dedupeKey)) {
    debugLog('skip duplicate', dedupeKey);
    return;
  }

  Promise.all([
    Promise.resolve(firstNonEmpty([
      readDataLayerValue(['ga_session_id', 'gaSessionId']),
      trim(lastTouch.ga_session_id),
      trim(imwebSession.ga_session_id)
    ])).then(function (value) {
      if (value) return value;
      return getGtagValue('session_id').then(function (gtagValue) {
        if (gtagValue) return gtagValue;
        for (var i = 0; i < CONFIG.measurementIds.length; i += 1) {
          var cookieValue = readCookie(getMeasurementCookieName(CONFIG.measurementIds[i]));
          var parsed = parseSessionIdFromGaCookie(cookieValue);
          if (parsed) return parsed;
        }
        return '';
      });
    }),
    Promise.resolve(firstNonEmpty([
      readDataLayerValue(['client_id', 'clientId', 'ga_client_id', 'gaClientId']),
      trim(lastTouch.client_id),
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
      trim(imwebSession.user_pseudo_id),
      clientId
    ]);

    var payload = {
      touchpoint: 'payment_success',
      captureMode: 'live',
      source: CONFIG.source,
      orderId: orderId,
      paymentKey: paymentKey,
      clientObservedAt: new Date().toISOString(),
      referrer: document.referrer || '',
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
      metadata: {
        snippetVersion: '2026-04-08',
        ga_measurement_ids: CONFIG.measurementIds,
        imweb_landing_url: trim(imwebSession.utmLandingUrl),
        initial_referrer: firstNonEmpty([trim(imwebSession.initialReferrer), trim(lastTouch.referrer)]),
        original_referrer: firstNonEmpty([trim(imwebSession.initialReferrer), trim(lastTouch.referrer)]),
        user_pseudo_id_strategy: userPseudoId && userPseudoId === clientId ? 'client_id_fallback' : 'explicit_value'
      }
    };

    if (!payload.orderId && !payload.paymentKey && payload.referrer.indexOf('paymentKey=') < 0 && payload.referrer.indexOf('orderNo=') < 0 && payload.referrer.indexOf('orderId=') < 0) {
      debugLog('skip: no order/payment key hint', payload);
      return;
    }

    debugLog('send payload', payload);
    return sendPayload(payload).then(function (result) {
      debugLog('send ok', result);
      return result;
    }).catch(function (error) {
      debugLog('send failed', error && error.message ? error.message : error);
    });
  });
})();
</script>
```

#### 추가만 하면 되는가, 수정이 필요한가

- **1차 답**: 우선은 **기존 푸터 코드는 그대로 두고, 위 블록만 맨 아래에 추가**하면 되오.
- **단서**: 배포 후 결제완료 1건 테스트에서 Network 탭에 `payment-success` 전송이 2건 잡히면, 기존 푸터 안에 숨어 있는 예전 payment-success sender를 제거해야 하오.
- **즉 최종 답은** “처음엔 추가만으로 시작, 중복이 확인되면 기존 sender 블록만 교체”요.
- `gtag('set', { user_id })`, `rebuyz_utm`, `rebuyz_view` 같은 기존 footer 로직은 **이번 작업 때문에 바로 수정할 필요는 없소**.

### 이번 턴에 만든 파일

- [imwebAttributionSnippet.ts](/Users/vibetj/coding/seo/backend/src/imwebAttributionSnippet.ts)
- [render-imweb-attribution-snippet.ts](/Users/vibetj/coding/seo/backend/scripts/render-imweb-attribution-snippet.ts)
- [imweb-attribution-snippet.test.ts](/Users/vibetj/coding/seo/backend/tests/imweb-attribution-snippet.test.ts)
- [biocom_payment_success_caller.html](/Users/vibetj/coding/seo/imweb/biocom_payment_success_caller.html)
- [payment_success_install.md](/Users/vibetj/coding/seo/imweb/payment_success_install.md)

### 실제로 확인한 것

- `biocom.kr` 홈페이지 HTML에는 기존 푸터/커스텀 코드가 이미 있었소. `gtag('set', { user_id })`, `rebuyz_utm`, `rebuyz_view`, 그리고 `shop_payment_complete` / `shop_order_done` 조건문까지 확인했소.
- 반대로 현재 라이브 HTML에서는 `/api/attribution/payment-success`, `ga_session_id`, `client_id`, `user_pseudo_id`가 안 보여서, **새 attribution 스니펫은 아직 publish되지 않은 상태**로 판단했소.
- 고정 공개 주소 `https://att.ainativeos.net/api/attribution/ledger?limit=1`는 `200` 응답을 돌려줬고, `ngrok` 주소와 같은 ledger summary를 반환했소. 즉 payment-success caller 기준 정본 endpoint는 `att.ainativeos.net`로 보는 게 맞소.
- `7020`에서 돌고 있던 기존 백엔드는 `/api/attribution/ledger`는 응답했지만 `/api/attribution/caller-coverage`는 `404`였소.
- public `att.ainativeos.net`도 `caller-coverage`는 아직 `404`였소. 그래서 coverage 검증은 최신 소스를 띄운 로컬 backend에서 봤소.
- 그래서 최신 소스를 임시 `7021`에 띄워 route와 숫자를 확인했고, 확인 후 종료했소.
- 최신 코드 기준에서도 coverage는 아직 `0%`였소.

### 이 문장의 쉬운 뜻

기존 문장:

> 미완료. 실제 live coverage 반등은 아직 없소. 왜냐하면 caller가 저장소 밖의 아임웹 관리자에 있고, 이번 턴에서는 운영 페이지에 publish하지 않았기 때문이오.

쉬운 뜻:

> **바이오컴 실제 사이트에는 기존 푸터 코드는 이미 있지만, 우리가 만든 새 attribution 스니펫은 아직 안 붙였소. 그래서 서버에 들어오는 실제 결제 데이터는 아직 예전 방식 그대로이고, 숫자도 아직 안 바뀌었소.**

### 다음 순서

1. [biocom_payment_success_caller.html](/Users/vibetj/coding/seo/imweb/biocom_payment_success_caller.html)을 바이오컴 아임웹의 기존 푸터/커스텀 코드에 병합하고 publish하오. 이 파일은 이미 `att.ainativeos.net` 기준으로 정리됐소.
2. `ngrok`는 기본값으로 쓰지 말고, `att.ainativeos.net` 장애 시 임시 우회용으로만 보오.
3. 결제완료 1건을 실제로 만든 뒤 아래를 확인하오.

```bash
curl -s http://localhost:7020/api/attribution/caller-coverage?source=biocom_imweb
curl -s 'https://att.ainativeos.net/api/attribution/ledger?source=biocom_imweb&captureMode=live&limit=5'
```

4. 그때 `ga_session_id` 또는 `client_id`가 일부라도 들어오기 시작하면, 그 순간부터 “실제 적용 완료”라고 보면 되오. 단 `caller-coverage`는 최신 소스를 띄운 로컬 backend에서 보는 것이 안전하오.
