# NPay GTM [118] Intent Beacon 초안

작성 시각: 2026-04-27 11:21 KST
기준일: 2026-04-27
대상: 바이오컴 네이버페이 주문형 버튼, GTM `[118]` `HURDLERS - [데이터레이어] 네이버페이 구매 (제품상세)`
작성 목적: 네이버페이 버튼 클릭을 구매로 집계하지 않고, 결제 시도 intent만 `/api/attribution/npay-intent`에 저장하기 위한 GTM Custom HTML 초안을 제공한다.

## 10초 요약

이 코드는 purchase 태그가 아니다. 네이버페이 버튼 클릭 시점에 GA4 client_id, session_id, UTM, 상품, 페이지 정보를 서버에 남기는 보험 장치다. GTM Preview에서 요청이 201 또는 200으로 찍히는지만 확인하고, live publish는 TJ 승인 전에는 하지 않는다.

## 붙일 위치

| 항목 | 값 |
|---|---|
| GTM 태그 | `[118] HURDLERS - [데이터레이어] 네이버페이 구매 (제품상세)` |
| 실행 시점 | 기존 NPay 버튼 클릭 trigger 그대로 사용 |
| 서버 endpoint | `https://att.ainativeos.net/api/attribution/npay-intent` |
| 저장소 | `local_crm_sqlite.npay_intent_log` |
| 전환 의미 | `npay_intent`, purchase 아님 |

## Custom HTML 초안

아래 코드는 `[118]` 태그 안에 추가할 초안이다. 기존 dataLayer push나 HurdlersTracker 호출을 지우지 않고, 맨 아래에 붙이는 방식이 안전하다.

```html
<script>
  (function () {
    try {
      var ENDPOINT = "https://att.ainativeos.net/api/attribution/npay-intent";
      var MEASUREMENT_COOKIE_SUFFIX = "WJFXN5E2Q1"; // G-WJFXN5E2Q1

      function getCookie(name) {
        var cookies = document.cookie ? document.cookie.split(";") : [];
        for (var i = 0; i < cookies.length; i += 1) {
          var cookie = cookies[i].trim();
          if (cookie.indexOf(name + "=") === 0) {
            return decodeURIComponent(cookie.substring(name.length + 1));
          }
        }
        return "";
      }

      function getGaClientId() {
        var value = getCookie("_ga");
        var match = value.match(/^GA\d+\.\d+\.(.+)$/);
        return match ? match[1] : value;
      }

      function getGaSessionId() {
        var value = getCookie("_ga_" + MEASUREMENT_COOKIE_SUFFIX);
        var oldFormat = value.match(/^GS\d+\.\d+\.(\d+)\./);
        if (oldFormat) return oldFormat[1];
        var newFormat = value.match(/(?:^|\$)s(\d+)/);
        return newFormat ? newFormat[1] : "";
      }

      function getGaSessionNumber() {
        var value = getCookie("_ga_" + MEASUREMENT_COOKIE_SUFFIX);
        var oldFormat = value.match(/^GS\d+\.\d+\.\d+\.(\d+)\./);
        if (oldFormat) return oldFormat[1];
        var newFormat = value.match(/(?:^|\$)o(\d+)/);
        return newFormat ? newFormat[1] : "";
      }

      function getParam(name) {
        try {
          return new URLSearchParams(window.location.search).get(name) || "";
        } catch (e) {
          return "";
        }
      }

      function getProduct() {
        var source = window.hurdlers_ga4 || {};
        return {
          product_idx: String(source.product_id || getParam("idx") || ""),
          product_name: String(source.product_name || "").replace(/&lt;/g, "<").replace(/&gt;/g, ">"),
          product_price: Number(source.product_price || 0) || null
        };
      }

      function createEventId() {
        if (window.crypto && typeof window.crypto.randomUUID === "function") {
          return window.crypto.randomUUID();
        }
        return "npay-" + Date.now() + "-" + Math.random().toString(36).slice(2);
      }

      var product = getProduct();
      var payload = {
        site: "biocom",
        source: "gtm_118",
        environment: "preview",
        debug_mode: true,
        captured_at: new Date().toISOString(),
        client_id: getGaClientId(),
        ga_session_id: getGaSessionId(),
        ga_session_number: getGaSessionNumber(),
        gclid: getParam("gclid"),
        gbraid: getParam("gbraid"),
        wbraid: getParam("wbraid"),
        fbclid: getParam("fbclid"),
        fbp: getCookie("_fbp"),
        fbc: getCookie("_fbc"),
        utm_source: getParam("utm_source"),
        utm_medium: getParam("utm_medium"),
        utm_campaign: getParam("utm_campaign"),
        utm_content: getParam("utm_content"),
        utm_term: getParam("utm_term"),
        page_location: window.location.href,
        page_referrer: document.referrer || "",
        product_idx: product.product_idx,
        product_name: product.product_name,
        product_price: product.product_price,
        button_selector: ".npay_btn_pay",
        gtm_event_id: createEventId()
      };

      var body = JSON.stringify(payload);
      var sent = false;
      if (navigator.sendBeacon) {
        sent = navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "text/plain" }));
      }
      if (!sent && window.fetch) {
        window.fetch(ENDPOINT, {
          method: "POST",
          mode: "cors",
          credentials: "omit",
          headers: { "Content-Type": "text/plain" },
          body: body,
          keepalive: true
        }).catch(function () {});
      }
    } catch (error) {
      // NPay 결제 흐름을 막지 않는다.
    }
  })();
</script>
```

## Preview 확인 순서

| 순서 | 무엇 | 성공 기준 |
|---:|---|---|
| 1 | GTM Preview로 바이오컴 상품 상세 페이지 접속 | `[118]` 태그가 NPay 버튼 클릭 때만 실행된다 |
| 2 | NPay 버튼 1회 클릭 | Network에 `POST https://att.ainativeos.net/api/attribution/npay-intent`가 보인다 |
| 3 | 응답 확인 | 신규 클릭은 201, 중복 클릭은 200과 `deduped: true` 가능 |
| 4 | 서버 목록 확인 | `GET https://att.ainativeos.net/api/attribution/npay-intents?limit=5`에서 최신 intent가 보인다 |
| 5 | 의미 확인 | 어떤 GA4/Meta/Google Ads purchase도 이 클릭만으로 전송하지 않는다 |

## Live Publish 전 체크

| 체크 | 기준 |
|---|---|
| endpoint 배포 | 운영 `att.ainativeos.net`에 `/api/attribution/npay-intent`가 201/200 응답 |
| CORS | `https://biocom.kr`, `https://www.biocom.kr`, `https://m.biocom.kr`에서 허용 |
| 중복 | 같은 클릭 반복/재시도가 `duplicate_count`로만 증가 |
| 개인정보 | 원문 전화번호, 이메일, 이름을 payload에 넣지 않음 |
| Google Ads [248] | 아직 변경하지 않음. intent 수집 안정화 후 별도 승인 |

## 운영 반영 금지선

아래는 TJ 승인 전에는 하지 않는다.

1. GTM live publish
2. Google Ads `[248]` primary/secondary 변경
3. GA4 Measurement Protocol purchase 전송
4. Meta CAPI Purchase 전송
5. 운영 DB schema 변경
