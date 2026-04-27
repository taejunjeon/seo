# NPay GTM [118] Intent Beacon 초안

작성 시각: 2026-04-27 11:21 KST
기준일: 2026-04-27
대상: 바이오컴 네이버페이 주문형 버튼, GTM `[118]` `HURDLERS - [데이터레이어] 네이버페이 구매 (제품상세)`
작성 목적: 네이버페이 버튼 클릭을 구매로 집계하지 않고, 결제 시도 intent만 `/api/attribution/npay-intent`에 저장하기 위한 GTM Custom HTML 초안을 제공한다.

## 10초 요약

이 코드는 purchase 태그가 아니다. 네이버페이 버튼 클릭 시점에 GA4 client_id, session_id, UTM, 상품, 페이지 정보를 서버에 남기는 보험 장치다. Preview에서는 `environment: "preview"`, `debug_mode: true`로만 확인하고, live publish 전에는 반드시 `environment: "live"`, `debug_mode: false`로 바꾼다. live publish는 TJ 승인 전에는 하지 않는다.

2026-04-27 18:10 KST 기준 이 문서의 beacon은 live version `139`로 publish됐다. 최종 publish는 stale 상태였던 Default Workspace(147)가 아니라 live v138 기준의 새 Workspace(150)에서 진행했다. 2026-04-27 18:16 KST live smoke에서 `environment=live`, `ga_session_id=1777281391`, `product_idx=423` 저장을 확인했다.

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
    var ENDPOINT = "https://att.ainativeos.net/api/attribution/npay-intent";
    var MEASUREMENT_COOKIE_SUFFIX = "WJFXN5E2Q1"; // G-WJFXN5E2Q1
    var ENVIRONMENT = "preview"; // live publish 승인 후 "live"로 변경
    var DEBUG_MODE = true; // live publish 승인 후 false로 변경

    function firstNonEmpty(values) {
      for (var i = 0; i < values.length; i += 1) {
        var value = values[i];
        if (value !== null && value !== undefined && String(value).trim()) {
          return String(value).trim();
        }
      }
      return "";
    }

    function getCookie(name) {
      var cookies = document.cookie ? document.cookie.split(";") : [];
      for (var i = 0; i < cookies.length; i += 1) {
        var cookie = cookies[i].trim();
        if (cookie.indexOf(name + "=") === 0) {
          return cookie.substring(name.length + 1);
        }
      }
      return "";
    }

    function getGaCookieRaw() {
      return getCookie("_ga");
    }

    function getGaClientId() {
      var value = getGaCookieRaw();
      var match = value.match(/^GA\d+\.\d+\.(.+)$/);
      return match ? match[1] : value;
    }

    function getGaSessionId() {
      var value = getCookie("_ga_" + MEASUREMENT_COOKIE_SUFFIX);
      var oldFormat = value.match(/^GS\d+\.\d+\.(\d+)\./);
      if (oldFormat) return oldFormat[1];
      var newFormat = value.match(/(?:^|[.$])s(\d+)/);
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

    function getStoredValue(names) {
      for (var i = 0; i < names.length; i += 1) {
        try {
          var localValue = window.localStorage && window.localStorage.getItem(names[i]);
          if (localValue) return localValue;
        } catch (e1) {}
        try {
          var sessionValue = window.sessionStorage && window.sessionStorage.getItem(names[i]);
          if (sessionValue) return sessionValue;
        } catch (e2) {}
      }
      return "";
    }

    function getCampaignValue(name) {
      return firstNonEmpty([
        getParam(name),
        getStoredValue([name, "seo_" + name])
      ]);
    }

    function getLatestDataLayerItem() {
      var dataLayer = window.dataLayer || [];
      for (var i = dataLayer.length - 1; i >= 0; i -= 1) {
        var ecommerce = dataLayer[i] && dataLayer[i].ecommerce;
        var items = ecommerce && ecommerce.items;
        if (items && items.length) return items[0] || {};
      }
      return {};
    }

    function readMeta(selector) {
      var node = document.querySelector(selector);
      return node ? (node.getAttribute("content") || "") : "";
    }

    function getProduct() {
      var source = window.hurdlers_ga4 || {};
      var dataLayerItem = getLatestDataLayerItem();
      return {
        product_idx: firstNonEmpty([
          source.product_id,
          source.item_id,
          dataLayerItem.item_id,
          dataLayerItem.id,
          getParam("idx")
        ]),
        product_name: firstNonEmpty([
          source.product_name,
          source.item_name,
          dataLayerItem.item_name,
          dataLayerItem.name,
          readMeta('meta[property="og:title"]'),
          document.title
        ]).replace(/&lt;/g, "<").replace(/&gt;/g, ">"),
        product_price: Number(firstNonEmpty([
          source.product_price,
          source.price,
          dataLayerItem.price
        ])) || null
      };
    }

    function getMemberCode() {
      var source = window.hurdlers_ga4 || {};
      return firstNonEmpty([
        window.member_code,
        window.IMWEB_MEMBER_CODE,
        window.hurdlers_member_code,
        source.member_code,
        source.user_id
      ]);
    }

    function createEventId() {
      if (window.crypto && typeof window.crypto.randomUUID === "function") {
        return window.crypto.randomUUID();
      }
      return "npay-" + Date.now() + "-" + Math.random().toString(36).slice(2);
    }

    try {
      var product = getProduct();
      var payload = {
        site: "biocom",
        source: "gtm_118",
        environment: ENVIRONMENT,
        debug_mode: DEBUG_MODE,
        captured_at: new Date().toISOString(),
        client_id: getGaClientId(),
        ga_cookie_raw: getGaCookieRaw(),
        ga_session_id: getGaSessionId(),
        ga_session_number: getGaSessionNumber(),
        gclid: firstNonEmpty([getParam("gclid"), getStoredValue(["gclid", "seo_gclid"])]),
        gbraid: firstNonEmpty([getParam("gbraid"), getStoredValue(["gbraid", "seo_gbraid"])]),
        wbraid: firstNonEmpty([getParam("wbraid"), getStoredValue(["wbraid", "seo_wbraid"])]),
        fbclid: firstNonEmpty([getParam("fbclid"), getStoredValue(["fbclid", "seo_fbclid"])]),
        gcl_aw: getCookie("_gcl_aw"),
        gcl_dc: getCookie("_gcl_dc"),
        fbp: getCookie("_fbp"),
        fbc: getCookie("_fbc"),
        utm_source: getCampaignValue("utm_source"),
        utm_medium: getCampaignValue("utm_medium"),
        utm_campaign: getCampaignValue("utm_campaign"),
        utm_content: getCampaignValue("utm_content"),
        utm_term: getCampaignValue("utm_term"),
        page_location: window.location.href,
        page_referrer: document.referrer || "",
        product_idx: product.product_idx,
        product_name: product.product_name,
        product_price: product.product_price,
        member_code: getMemberCode(),
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
| 4 | 서버 목록 확인 | `GET https://att.ainativeos.net/api/attribution/npay-intents?limit=5`에 `x-admin-token` 또는 `Authorization: Bearer ...`를 붙이면 최신 intent가 보인다 |
| 5 | 의미 확인 | 어떤 GA4/Meta/Google Ads purchase도 이 클릭만으로 전송하지 않는다 |

## 2026-04-27 보정 기록

| 시각 | 항목 | 결과 |
|---|---|---|
| 2026-04-27 14:57 KST | TJ Preview 클릭 | 저장 성공. 단 1회 클릭이 2건 저장됐고 `ga_session_id` 공백 |
| 2026-04-27 15:56 KST | GTM Workspace 147 tag 118 보정 | `getGaSessionId()` 정규식을 `/(?:^|[.$])s(\\d+)/`로 수정 |
| 2026-04-27 15:56 KST | quick_preview | `compilerError: false`, fingerprint `1777272925667` |
| 2026-04-27 15:58 KST | backend dedupe 운영 재배포 | 30초 lookback dedupe 반영, health 200 |
| 2026-04-27 16:42 KST | TJ Preview 재검증 | 최신 intent 1건 저장, `ga_session_id=1777275745`, `ga_session_number=15` |
| 2026-04-27 18:10 KST | GTM live publish | version `139`, `npay_intent_only_live_20260427` |
| 2026-04-27 18:16 KST | live smoke | 최신 intent 1건 저장, `environment=live`, `ga_session_id=1777281391`, `product_idx=423` |

Preview와 live smoke 모두 통과했다. 다음 단계는 24시간 수집 품질 확인과 7일 NPay 주문 매칭 dry-run이다.

## Preview 필수 payload 기준

Preview에서 요청이 간 것만으로는 부족하다. 최신 intent 1건에서 아래 값을 확인한다.

| 필드 | 성공 기준 |
|---|---|
| `client_id` | `_ga` prefix를 제거한 `123456789.987654321` 형태 |
| `ga_cookie_raw` | 원본 `_ga` 쿠키값. 예: `GA1.1.123456789.987654321` |
| `ga_session_id` | 값 있음 |
| `product_idx` | 값 있음. 비면 주문 매칭 점수 하락 |
| `product_name` | Hurdlers/dataLayer/meta/title 중 하나라도 들어옴 |
| `page_location` | 서버 저장 시 query whitelist만 남음 |
| `captured_at` | 클릭 시각 ISO 문자열 |
| `member_code` | 있으면 좋음. 없으면 Preview 결과에 "미확인"으로 기록 |

## Live Publish 전 체크

| 체크 | 기준 |
|---|---|
| endpoint 배포 | 운영 `att.ainativeos.net`에 `/api/attribution/npay-intent`가 201/200 응답 |
| CORS | `https://biocom.kr`, `https://www.biocom.kr`, `https://m.biocom.kr`에서 허용 |
| 중복 | 같은 클릭 반복/재시도가 `duplicate_count`로만 증가 |
| 개인정보 | 원문 전화번호, 이메일, 이름을 payload에 넣지 않음. 서버는 `page_location` query whitelist를 적용 |
| 조회 보호 | `NPAY_INTENT_ADMIN_TOKEN` 또는 `AIBIO_NATIVE_ADMIN_TOKEN`으로 `GET /npay-intents` 보호 |
| Google Ads [248] | 아직 변경하지 않음. intent 수집 안정화 후 별도 승인 |

## 운영 반영 금지선

아래는 TJ 승인 전에는 하지 않는다.

1. GTM live publish
2. Google Ads `[248]` primary/secondary 변경
3. GA4 Measurement Protocol purchase 전송
4. Meta CAPI Purchase 전송
5. 운영 DB schema 변경
