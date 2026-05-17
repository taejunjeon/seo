# 더클린커피 [AGENTSOS] 주문서작성 begin_checkout Custom HTML 초안

작성 시각: 2026-05-18 03:38 KST
기준일: 2026-05-18
문서 성격: GTM Custom HTML 교체 초안 / Preview 전용 적용 가이드 / no-publish 설계 문서

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - docurule.md
    - harness/common/HARNESS_GUIDELINES.md
  lane: Green
  allowed_actions:
    - documentation_update
    - custom_html_draft
    - preview_checklist
  forbidden_actions:
    - gtm_submit_create_version_publish
    - imweb_header_footer_save
    - ga4_measurement_protocol_send
    - meta_capi_send
    - google_ads_send_or_upload
    - operating_db_write
    - vm_cloud_deploy
source_window_freshness_confidence:
  site: thecleancoffee
  source: TJ님 GTM Preview 캡처 + Chrome read-only DOM/dataLayer 확인
  window: 2026-05-18 KST 주문서 화면 테스트
  freshness: fresh
  confidence: high for selector mismatch, medium for final selector coverage until GTM Preview retest
```

## 10초 요약

더클린커피 주문서 화면에서 `begin_checkout`이 안 잡힌 직접 원인은 기존 주문서작성 HTML이 현재 주문서 DOM과 맞지 않는 선택자를 쓰기 때문이다.
이 문서는 기존 `HURDLERS - [데이터레이어] 주문서작성`을 `[AGENTSOS] - [데이터레이어] 주문서작성`으로 바꾸는 교체 초안이다.
표준 이벤트 이름은 `begin_checkout` 그대로 유지한다. 이름을 바꾸면 GA4/Meta/광고 플랫폼이 “결제 시작”으로 이해하지 못할 수 있다.
GTM 저장/게시, 외부 전송, VM Cloud 배포는 이 문서에서 하지 않는다.

## 왜 바꾸는가

현재 기존 태그는 `.shop_item_thumb`, `.shop_item_title`, `.shop_item_pay`, `.shop_item_opt` 같은 요소를 찾는다.
하지만 2026-05-18 주문서 화면 read-only 확인에서는 해당 요소가 0개였고, 주문서 화면은 `#oms-shop-payment` 중심으로 렌더링되어 있었다.
그래서 기존 코드가 상품을 못 찾고, `dataLayer.push({ event: "begin_checkout" })`까지 도달하지 못한다.

## 2026-05-18 03:53 추가 관측 — 두 번째 상품에서 tag fired but event missing

TJ님이 다른 상품으로 주문서 화면에 진입했을 때 `AGENTSOS - [begin_checkout] 주문서작성` Custom HTML 태그는 Fired 되었지만, 좌측 이벤트 목록에 `begin_checkout` custom event가 생기지 않았다.

Codex Chrome read-only 확인 결과:

- 주문서 화면 path는 `/shop_payment/`였다.
- 기존 `.shop_item_thumb`, `.shop_item_title`, `.shop_item_pay`, `.shop_item_opt` selector는 0개였다.
- 화면 본문에는 상품명, 금액, 수량, 상품 링크가 있어서 text fallback으로 상품 1개를 만들 수 있었다.
- `sessionStorage`의 AGENTSOS dedupe key는 없어서, “이미 보냈기 때문에 막힘”은 이번 원인이 아니었다.
- 해당 페이지 실행 문맥에서 전역 `parseInt`가 함수가 아닌 상태로 관측됐다. 따라서 Custom HTML 안에서 bare `parseInt(...)`를 쓰면 일부 페이지에서 스크립트가 중단될 수 있다.

판정: 이번 케이스는 Codex Chrome Extension 충돌이라기보다, 주문서작성 Custom HTML 내부의 parsing/selector 안정성 문제다. v1.1에서는 `Number(...)` 기반 파서, 상품 단위 dedupe key, text fallback, try/catch를 강화한다.

## 이름 변경 원칙

- GTM 태그 이름: `HURDLERS - [데이터레이어] 주문서작성` → `[AGENTSOS] - [데이터레이어] 주문서작성`
- GTM 트리거 이름: `HURDLE - [DOM 사용 가능] 주문서작성` → `[AGENTSOS] - [DOM 사용 가능] 주문서작성`
- GA4 이벤트 전송 태그 이름: `HURDLES - [이벤트전송] 주문서작성` → `[AGENTSOS] - [이벤트전송] 주문서작성`
- GA4 event_name: `begin_checkout` 유지
- dataLayer 새 네임스페이스: `agentsos_ga4`

중요한 호환성 메모: 기존 GA4 이벤트 전송 태그가 아직 `hurdlers_ga4.items`를 읽고 있을 가능성이 높다. 그래서 아래 초안은 `agentsos_ga4`와 `hurdlers_ga4`를 동시에 넣는다. GTM 변수까지 `[AGENTSOS]`로 바꾼 뒤에는 `hurdlers_ga4` 호환 필드를 제거하면 된다.

## 교체용 Custom HTML 초안 v1.1

아래 코드는 GTM Custom HTML 태그의 HTML 칸에 그대로 넣는 초안이다.

```html
<!-- AGENTSOS Checkout EVENT v1.1 -->
<script>
(function () {
  'use strict';

  var CONFIG = {
    site: 'thecleancoffee',
    brand: 'thecleancoffee',
    version: '2026-05-18-agentsos-begin-checkout-v1-1',
    rootSelector: '#oms-shop-payment',
    dedupePrefix: 'AGENTSOS_begin_checkout_sent_v1_1:',
    itemStorageKey: 'AGENTSOS_checkout_items_v1_1',
    maxAttempts: 12,
    retryMs: 300,
    debugParam: 'agentsos_debug'
  };

  function trim(value) {
    if (value == null) return '';
    return String(value).trim();
  }

  function isDebugMode() {
    try {
      return new URLSearchParams(window.location.search).get(CONFIG.debugParam) === '1';
    } catch (error) {
      return false;
    }
  }

  function debugLog() {
    if (!isDebugMode()) return;
    try {
      console.log.apply(console, ['[AGENTSOS begin_checkout]'].concat([].slice.call(arguments)));
    } catch (error) {}
  }

  function debugWarn() {
    if (!isDebugMode()) return;
    try {
      console.warn.apply(console, ['[AGENTSOS begin_checkout]'].concat([].slice.call(arguments)));
    } catch (error) {}
  }

  function isCheckoutPage() {
    return /\/shop_payment\/?/i.test(String(window.location.pathname || ''));
  }

  function parseNumber(value) {
    var normalized = trim(value).replace(/[^\d.-]/g, '');
    if (!normalized) return 0;
    var parsed = Number(normalized);
    return parsed === parsed && parsed !== Infinity && parsed !== -Infinity ? parsed : 0;
  }

  function parseQuantity(value) {
    var text = trim(value);
    var match = text.match(/(\d+)\s*개/);
    if (match) return Math.max(1, parseNumber(match[1]) || 1);

    match = text.match(/수량\s*:?\s*(\d+)/i);
    if (match) return Math.max(1, parseNumber(match[1]) || 1);

    return 1;
  }

  function normalizeItem(raw) {
    raw = raw || {};

    var itemName = trim(raw.item_name || raw.name);
    var itemId = trim(raw.item_id || raw.id);
    var price = parseNumber(raw.price);
    var quantity = parseQuantity(raw.quantity || raw.qty || '1');

    if (!itemName || price <= 0) return null;

    return {
      item_name: itemName,
      item_id: itemId,
      price: String(price),
      quantity: quantity,
      item_brand: trim(raw.item_brand || CONFIG.brand)
    };
  }

  function getRoot() {
    return document.querySelector(CONFIG.rootSelector) || document.body;
  }

  function collectFromLegacySelectors(root) {
    var items = [];
    var nodes = root.querySelectorAll('.shop_item_thumb');

    nodes.forEach(function (node) {
      try {
        var titleNode = node.querySelector('.shop_item_title');
        var priceNode = node.querySelector('.shop_item_pay > span');
        var optionNode = node.querySelector('.shop_item_opt');
        var linkNode = node.querySelector('a[href*="shop_view"]');

        var itemId = '';
        if (linkNode && linkNode.href) {
          try {
            itemId = new URL(linkNode.href, window.location.origin).searchParams.get('idx') || '';
          } catch (error) {}
        }

        var normalized = normalizeItem({
          item_name: titleNode && titleNode.innerText,
          item_id: itemId,
          price: priceNode && priceNode.innerText,
          quantity: optionNode && optionNode.innerText,
          item_brand: CONFIG.brand
        });

        if (normalized) items.push(normalized);
      } catch (error) {
        debugLog('legacy selector item parse skipped', error && error.message ? error.message : error);
      }
    });

    return items;
  }

  function firstMeaningfulProductLine(lines) {
    for (var i = 0; i < lines.length; i += 1) {
      var line = lines[i];
      if (!line) continue;
      if (/주문\s*상품|상품\s*정보|배송|주문자|결제|쿠폰|적립|포인트|총\s*상품|합계/.test(line)) continue;
      if (/^\d[\d,]*\s*원$/.test(line)) continue;
      if (/^\d+\s*개$/.test(line)) continue;
      if (/필수|선택|옵션/.test(line) && line.length < 20) continue;
      if (line.length >= 4) return line;
    }
    return '';
  }

  function collectFromOrderPageText(root) {
    var text = trim(root.innerText || root.textContent || '');
    if (!text) return [];

    var lines = text.split(/\n+/).map(trim).filter(Boolean);
    var startIndex = -1;

    for (var i = 0; i < lines.length; i += 1) {
      if (/주문\s*상품|상품\s*정보/.test(lines[i])) {
        startIndex = i + 1;
        break;
      }
    }

    var section = startIndex >= 0 ? lines.slice(startIndex) : lines;
    var stopIndex = -1;

    for (var j = 0; j < section.length; j += 1) {
      if (/배송\s*정보|주문자\s*정보|결제\s*수단|최종\s*결제|총\s*결제|약관/.test(section[j])) {
        stopIndex = j;
        break;
      }
    }

    if (stopIndex >= 0) {
      section = section.slice(0, stopIndex);
    }

    var itemName = firstMeaningfulProductLine(section);
    var priceLine = '';
    var quantityLine = '';

    for (var k = 0; k < section.length; k += 1) {
      if (!priceLine && /[\d,]+\s*원/.test(section[k])) priceLine = section[k];
      if (!quantityLine && /\d+\s*개/.test(section[k])) quantityLine = section[k];
    }

    var itemId = '';
    var productLink = root.querySelector('a[href*="shop_view"][href*="idx="]');
    if (productLink && productLink.href) {
      try {
        itemId = new URL(productLink.href, window.location.origin).searchParams.get('idx') || '';
      } catch (error) {}
    }

    var normalized = normalizeItem({
      item_name: itemName,
      item_id: itemId,
      price: priceLine,
      quantity: quantityLine,
      item_brand: CONFIG.brand
    });

    return normalized ? [normalized] : [];
  }

  function collectItems() {
    var root = getRoot();
    if (!root) return [];

    var items = collectFromLegacySelectors(root);
    if (items.length > 0) return items;

    items = collectFromOrderPageText(root);
    if (items.length > 0) return items;

    return [];
  }

  function safeHash(input) {
    var text = trim(input);
    var hash = 0;
    var i;
    var chr;

    if (!text) return 'h0';

    for (i = 0; i < text.length; i += 1) {
      chr = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0;
    }

    return 'h' + Math.abs(hash).toString(36);
  }

  function getDedupeKey(items) {
    var signature = String(window.location.pathname || '') + '|' + items.map(function (item) {
      return [
        trim(item.item_id),
        trim(item.item_name).slice(0, 60),
        trim(item.price),
        trim(item.quantity)
      ].join(':');
    }).join('|');

    /*
      Do not use raw order_code/order_no/order_member in sessionStorage key.
      This key only represents the current checkout product signature.
    */
    return CONFIG.dedupePrefix + safeHash(signature);
  }

  function hasSent(items) {
    try {
      return Boolean(window.sessionStorage && window.sessionStorage.getItem(getDedupeKey(items || [])));
    } catch (error) {
      return false;
    }
  }

  function rememberSent(items) {
    try {
      if (!window.sessionStorage) return;
      window.sessionStorage.setItem(getDedupeKey(items || []), new Date().toISOString());
      window.sessionStorage.setItem(CONFIG.itemStorageKey, JSON.stringify(items));
    } catch (error) {}
  }

  function totalValue(items) {
    var sum = 0;
    items.forEach(function (item) {
      sum += parseNumber(item.price) * parseQuantity(item.quantity);
    });
    return sum;
  }

  function pushBeginCheckout(items) {
    if (!items || items.length === 0) return false;
    if (hasSent(items)) {
      debugLog('skip duplicate begin_checkout');
      return true;
    }

    window.dataLayer = window.dataLayer || [];

    var value = totalValue(items);
    var ecommercePayload = {
      currency: 'KRW',
      value: value,
      items: items
    };

    window.dataLayer.push({
      event: 'begin_checkout',
      event_source: 'agentsos',
      agentsos_event_version: CONFIG.version,
      agentsos_ga4: ecommercePayload,

      /*
        Compatibility only:
        Existing GA4 event tag may still read hurdlers_ga4.items.
        Remove this field after GTM variables are renamed to agentsos_ga4.
      */
      hurdlers_ga4: ecommercePayload,

      ecommerce: ecommercePayload
    });

    rememberSent(items);

    debugLog('begin_checkout pushed', {
      item_count: items.length,
      value: value,
      has_agentsos_ga4: true,
      has_compat_namespace: true
    });

    return true;
  }

  function run(attempt) {
    attempt = attempt || 1;

    try {
      var items = collectItems();
      if (pushBeginCheckout(items)) return;
    } catch (error) {
      debugLog('begin_checkout attempt failed', error && error.message ? error.message : error);
    }

    if (attempt < CONFIG.maxAttempts) {
      window.setTimeout(function () {
        run(attempt + 1);
      }, CONFIG.retryMs);
    } else {
      debugWarn('begin_checkout not pushed: no product item found');
    }
  }

  if (!isCheckoutPage()) return;

  run(1);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      run(1);
    });
  } else {
    run(1);
  }

  window.addEventListener('load', function () {
    run(1);
  });
})();
</script>
<!-- AGENTSOS Checkout EVENT END -->
```

## 이 초안이 기존 코드보다 안전한 점

1. 주문서 화면에서 기존 선택자가 없어도 즉시 실패하지 않는다.
2. `#oms-shop-payment` 기반 주문서 화면을 우선 본다.
3. 상품 DOM이 늦게 뜨면 최대 약 3.6초 동안 재시도한다.
4. 한 주문서 화면에서 `begin_checkout`을 여러 번 보내지 않도록 sessionStorage dedupe를 둔다.
5. 주문번호, 결제키, 회원키, 전화번호, 이메일 같은 raw identifier를 dataLayer에 넣지 않는다.
6. 기존 GA4 이벤트 전송 태그가 `hurdlers_ga4`를 읽고 있어도 깨지지 않게 호환 필드를 임시로 둔다.

## GTM에서 같이 바꿀 이름

Preview에서 검증한 뒤 아래 이름으로 정리한다.

| 현재 이름 | 추천 이름 | 이유 |
| --- | --- | --- |
| `HURDLERS - [데이터레이어] 주문서작성` | `[AGENTSOS] - [데이터레이어] 주문서작성` | 코드 소유권과 관리 주체를 명확히 한다 |
| `HURDLE - [DOM 사용 가능] 주문서작성` | `[AGENTSOS] - [DOM 사용 가능] 주문서작성` | 주문서 화면 진입 조건이라는 의미를 사람이 알 수 있다 |
| `HURDLES - [이벤트전송] 주문서작성` | `[AGENTSOS] - [이벤트전송] 주문서작성` | GA4로 `begin_checkout`을 보내는 태그임을 명확히 한다 |

## Preview 확인 절차

1. GTM Preview를 연다.
2. 더클린커피 상품상세에서 구매하기를 눌러 주문서 화면으로 간다.
3. 좌측 이벤트 목록에 `begin_checkout`이 생기는지 본다.
4. `begin_checkout`을 클릭해 데이터 영역에서 아래를 확인한다.
   - `event = begin_checkout`
   - `agentsos_ga4.items` 있음
   - `agentsos_ga4.currency = KRW`
   - `agentsos_ga4.value`가 0보다 큼
   - `hurdlers_ga4.items`도 임시 호환으로 있음
   - raw 주문/결제/회원/연락처 식별자가 없음
5. 실행 태그에서 `[AGENTSOS] - [이벤트전송] 주문서작성` 또는 기존 주문서작성 GA4 이벤트 전송 태그가 Fired인지 확인한다.
6. GA4 DebugView 또는 BigQuery 다음 적재에서 `begin_checkout`이 0이 아닌지 확인한다.

## 2026-05-18 03:45 Preview 결과

TJ님 GTM Preview 기준으로 주문서 화면에서 `begin_checkout` 이벤트가 생성됐다.
`AGENTSOS - [begin_checkout] 주문서작성` Custom HTML은 1회 Fired 되었고, 기존 `HURDLES - [이벤트전송] 주문서작성` GA4 이벤트 태그도 1회 Fired 되었다.

확인된 dataLayer shape:

- `event = begin_checkout`
- `event_source = agentsos`
- `agentsos_event_version = 2026-05-18-agentsos-begin-checkout-v1`
- `agentsos_ga4.currency = KRW`
- `agentsos_ga4.value = 33900`
- `agentsos_ga4.items[0].item_id = 75`
- `agentsos_ga4.items[0].quantity = 1`
- `hurdlers_ga4` 호환 필드 있음
- `ecommerce` 표준 전자상거래 필드 있음

판정:

- Preview 기준 `begin_checkout` 복구 PASS.
- 기존 GA4 이벤트 전송 태그가 아직 `HURDLES` 이름이지만, 호환 필드 덕분에 정상 Fired.
- 다음 단계는 GA4 DebugView 또는 BigQuery 일별 export에서 `begin_checkout` 적재 확인이다.
- 문서에는 주문/결제/회원 raw identifier를 남기지 않았다.

## 2026-05-18 04:26 Preview 재검증 및 운영 게시

TJ님이 서로 다른 상품 2개에서 주문서 화면 진입을 재검증했다.

확인된 것:

- 첫 번째 상품: `AGENTSOS - [begin_checkout] 주문서작성` 1회 Fired, `HURDLES - [이벤트전송] 주문서작성` 1회 Fired.
- 두 번째 상품: `AGENTSOS - [begin_checkout] 주문서작성` 누적 2회 Fired, `HURDLES - [이벤트전송] 주문서작성` 누적 2회 Fired.
- 좌측 이벤트 목록에 `begin_checkout`이 생성됐다.

중요 해석:

- `AGENTSOS - [begin_checkout] 주문서작성`은 dataLayer를 만드는 태그다.
- `HURDLES - [이벤트전송] 주문서작성`은 dataLayer의 `begin_checkout`을 GA4 이벤트로 보내는 태그다.
- 따라서 두 태그가 동시에 Fired 되는 것은 중복이 아니라 정상적인 2단계 체인이다.
- `HURDLES`라는 이름은 업체명 잔재라 헷갈리지만, 지금 삭제하면 GA4 `begin_checkout` 전송이 끊길 수 있다.

운영 게시:

- GTM 컨테이너: `GTM-5M33GC4`
- 버전: `20`
- 버전 이름: `AGENTSOS begin_checkout v1.1 - 2026-05-18`
- 게시 시각: 2026-05-18 04:31 KST
- 변경 범위: `AGENTSOS - [begin_checkout] 주문서작성` 1건
- 하지 않은 것: Purchase/CAPI/운영DB/VM Cloud 변경 없음

남은 확인:

- GA4 DebugView 또는 Realtime에서 `begin_checkout` 수신 확인.
- 다음 BigQuery 일별 export 이후 `begin_checkout` 적재 확인.
- `HURDLES - [이벤트전송] 주문서작성`은 삭제가 아니라 이름 정리 및 변수 전환 후보로 남긴다.

## 2026-05-18 04:49 GA4 Realtime API 수신 확인

Codex가 GA4 Realtime Data API를 read-only로 직접 조회했다.
UI DebugView를 사람이 다시 열지 않아도, GA4 property `326949178` 기준 최근 실시간 창에서 `begin_checkout`이 수신된 것이 확인됐다.

조회 기준:

- site: thecleancoffee
- GA4 property: `326949178`
- measurement ID: `G-JLSBXX7300`
- 조회 방식: GA4 Realtime Data API `runRealtimeReport`
- 생성 시각: 2026-05-18 04:49 KST
- 외부 전송/운영DB write/GTM publish: 0

실시간 이벤트 확인값:

| event_name | realtime count | 해석 |
|---|---:|---|
| `page_view` | 8 | 페이지 조회 정상 |
| `scroll` | 4 | 스크롤 이벤트 정상 |
| `begin_checkout` | 2 | 주문서작성/결제 시작 수신 확인 |
| `view_item` | 2 | 상품 상세 조회 수신 확인 |
| `page_view_long` | 1 | 긴 조회 이벤트 일부 수신 확인 |

판정:

- GA4 Realtime 기준 `begin_checkout` 수신 PASS.
- `AGENTSOS - [begin_checkout] 주문서작성`은 dataLayer 생성 태그로 정상 작동한다.
- 기존 `HURDLES - [이벤트전송] 주문서작성`은 GA4로 보내는 sender 역할이므로 아직 삭제하면 안 된다.
- 다음 단계는 sender 이름만 `AGENTSOS`로 정리하는 승인안을 따로 만들고, 실제 이벤트명과 변수는 그대로 유지하는 것이다.

## 완전 AGENTSOS 전환을 위한 다음 단계

1. GTM 변수에서 `hurdlers_ga4.items`, `hurdlers_ga4.currency`, `hurdlers_ga4.value`를 읽는 항목을 찾는다.
2. 동일한 변수를 `agentsos_ga4.items`, `agentsos_ga4.currency`, `agentsos_ga4.value`로 복제한다.
3. GA4 이벤트 전송 태그가 새 변수로 정상 발화하는지 Preview에서 확인한다.
4. 이후 Custom HTML에서 `hurdlers_ga4` 호환 필드를 제거한다.

## 금지선

- 이 문서만으로 GTM Production Publish를 하면 안 된다.
- `begin_checkout`을 구매완료로 해석하면 안 된다.
- 주문서 진입은 결제 시작 신호이지 실제 결제완료가 아니다.
- Meta Purchase, GA4 purchase, Google Ads purchase로 직접 올리면 안 된다.
- raw 주문/결제/회원/연락처 식별자를 GTM Preview 캡처나 문서에 남기지 않는다.
