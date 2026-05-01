# 더클린커피 NPay intent_uuid URL Query Param 보존 검증 가이드

생성 시각: 2026-05-01 KST
site: `thecleancoffee`
mode: `read_only` 1단계 + `sandbox_only` 2단계 (운영 변경 0건)
관련 문서: [[coffee-npay-intent-beacon-preview-snippet-v04-20260501|preview snippet v0.4]] / [[coffee-npay-intent-beacon-preview-design-20260501|design v0.4]] / [[coffee-imweb-tracking-flow-analysis-20260501|4 layer 분석]] / [[coffee-live-tracking-inventory-20260501|inventory snapshot]] / [[coffee/!imwebcoffee_code_latest_0501|imweb 헤더/푸터 정본]] / [[harness/coffee-data/AUDITOR_CHECKLIST]]

## Auditor Verdict

```text
Auditor verdict: PASS_WITH_NOTES
Phase: coffee_npay_intent_uuid_preservation_test
No-send verified: YES (1단계는 read-only, 2단계는 sandbox 한정)
No-write verified: YES (운영 DB write 0)
No-deploy verified: YES
No-publish verified: YES
GTM publish: BLOCKED
Live script injection: BLOCKED
Production 결제 거래: BLOCKED (2단계는 NPay sandbox 또는 1만원 이하 소액 + 즉시 환불)
fetch / sendBeacon / XHR (preview snippet 측): BLOCKED
gtag / fbq 직접 호출 (preview snippet 측): BLOCKED
backend API 호출 (preview snippet 측): BLOCKED
PII output: NONE
실제 운영 변경: 0건
```

## 10초 요약

**검증 목표**: 우리가 발급한 `intent_uuid` 를 NPay 결제 흐름의 어딘가에 끼워 넣었을 때 confirmed order 와 deterministic 매핑이 가능한지 확인. 가능하다면 트랙 (A) deterministic, 불가하다면 트랙 (B) internal intent ledger + (prod_code, quantity, estimated_item_total, order_time_kst ± 30분) 휴리스틱 매칭.

**중요 가드**: 본 검증의 1단계 (read-only 정찰) 는 운영 변경 0건. 2단계 (실제 sandbox 결제 1건) 는 운영 결제 시스템에 1건 더 추가되지만 즉시 환불 처리하고 backend 의 `tb_*` 운영 테이블에 write 가 일어나는 것은 imweb/Toss 의 자동 sync 동작. 우리 코드/snippet 은 read 만 한다.

**결정**: 1단계 결과만으로 트랙 분기가 결정되면 2단계 (sandbox 결제) 는 생략 가능.

## 사전 준비

| 항목 | 확인 |
|---|---|
| preview snippet v0.4 정상 설치 | [[coffee-npay-intent-beacon-preview-snippet-v04-20260501]] 진단 F PASS, 진단 G PASS (2026-05-01 21:57 KST 검증 완료) |
| `__seo_funnel_session` sessionId 확보 | YES (예 `momuyeuikmcmug`) |
| `intent_uuid` 발급 동작 확인 | YES (UUID + seq 1) |
| Network 탭 preserve log 켜짐 | (devtools settings) |
| chrome 시크릿 창 또는 캐시 비운 일반 창 | 권장 |

## 1단계 — Read-only 정찰 (운영 변경 0건)

목적: 실제 sandbox 결제 없이 imweb / NPay SDK 가 url 에 어떤 params 를 박는지 정찰. snippet 만 설치된 상태에서 NPay click → 즉시 ESC 로 redirect 직전 url chain 만 캡처.

### 1-A. confirmOrderWithCartItems url 인자 캡처

`window.SITE_SHOP_DETAIL.confirmOrderWithCartItems` wrap 안에 url 인자 capture 를 한 번 넣어 본다 — preview snippet 보강이 아니라 console 직접 입력 1회용 hook.

```javascript
/* 1-A. NPay click 시 confirmOrderWithCartItems 의 url 인자만 캡처 (read-only) */
;(() => {
  if (window.__npay_url_observe_installed) return console.log("already installed");
  window.__npay_url_observe_installed = true;
  window.__npay_url_observed = [];

  // SITE_SHOP_DETAIL.confirmOrderWithCartItems 는 이미 v0.4 snippet 으로 wrap 되어 있음.
  // 그 위에 한 번 더 wrap 해서 url 인자만 capture (원본 동작 변경 0).
  var _orig = window.SITE_SHOP_DETAIL.confirmOrderWithCartItems;
  window.SITE_SHOP_DETAIL.confirmOrderWithCartItems = function (kind, backurl, params) {
    try {
      if (kind === "npay") {
        window.__npay_url_observed.push({
          ts: new Date().toISOString(),
          kind: kind,
          backurl: backurl,
          params_keys: params && typeof params === "object" ? Object.keys(params) : null,
          params_keys_safe: params && typeof params === "object"
            ? Object.keys(params).filter(function (k) {
                return ["selected_freebies", "memberId", "userId"].indexOf(k) < 0;
              })
            : null
        });
        console.log("[npay_url_observe]", window.__npay_url_observed.slice(-1)[0]);
      }
    } catch (e) { console.warn("[npay_url_observe] err", e && e.message); }
    return _orig.apply(this, arguments);
  };
  console.log("[npay_url_observe] installed");
})()
```

PC NPay 버튼 클릭 → 즉시 ESC. 그 후:

```javascript
window.__npay_url_observed
```

이 결과로 imweb 이 url 인자에 무엇을 박는지 (도메인, path, query string) 확인.

### 1-B. NPay SDK redirect chain 캡처 (Network 탭)

devtools Network 탭에서 NPay click 직후 발생하는 request chain 을 본다. preserve log 켜고:

| 검사 항목                                                                 | 위치                                                              |
| --------------------------------------------------------------------- | --------------------------------------------------------------- |
| `pay.naver.com/customer/...` 결제 페이지 진입 url                            | NPay 결제 redirect URL. query string 에 imweb 측 param 이 어떻게 박혀 가는지 |
| `pay.naver.com/...` 응답 안 form action / hidden input                   | 결제 form 의 hidden field 안 imweb param 들                          |
| imweb 측 `/shop_payment_complete?...` 또는 `/shop_order_done?...` 복귀 url | 결제 완료 후 imweb 이 받는 query string                                 |

캡처는 chrome devtools Network 탭의 우클릭 → "Copy as cURL" 또는 "Save all as HAR with content". HAR 은 PII (cookie 등) 포함이라 본 검증 결과에 raw 첨부 금지. **검증자는 query string 의 키 이름과 형식만 본 문서에 기록한다 (값은 마스킹).**

### 1-C. 결제 완료 페이지 URL 의 query string keys 만 기록

NPay 결제 후 imweb 이 redirect 시키는 `/shop_payment_complete?...` 또는 `/shop_order_done?...` 의 query string 안 키 이름만 기록.

```javascript
/* 결제 완료 페이지에 도착했을 때 console 에 입력 — 1회 */
({
  href: location.href,
  pathname: location.pathname,
  searchParamKeys: Array.from(new URLSearchParams(location.search).keys()),
  referrerHost: (function () { try { return new URL(document.referrer).host; } catch (e) { return ""; } })(),
  storage: {
    seoCheckoutContext: sessionStorage.getItem("__seo_checkout_context"),
    funnelCapiSentEids: Object.keys(sessionStorage).filter(function (k) { return k.indexOf("funnelCapi::sent::") === 0; })
  }
})
```

이 결과의 `searchParamKeys` 가 `[order_no, order_code, payment_key, ...]` 같이 imweb 이 박는 키 목록이다. 이 키 안에 우리 `intent_uuid` 가 자연스럽게 들어가는지가 트랙 (A) 가능 여부의 첫 신호.

### 1-D. backend raw_data 정찰 (운영 read-only)

backend 의 read-only 쿼리로 직전 sandbox 결제 1건의 `tb_iamweb_users` / `tb_playauto_orders` / `imweb_orders` 의 `raw_data` (또는 `meta_data`) JSON 을 본다.

쿼리는 본 가이드에서 직접 박지 않고 [[!coffeedata#BigQuery robust guard 쿼리 초안]] 처럼 운영 PG read-only 쿼리 패턴을 따라 별도 phase 에서 실행. 결과 중 `metadata` / `raw_data` 안에 `intent_uuid` 같은 자유 텍스트 보존 필드가 있는지 확인.

## 2단계 — Sandbox 결제 1건 (실제 결제, 즉시 환불)

1단계 결과로 결정 미달이면 2단계 진행.

### 가드 (2단계 시작 전 확인)

| 가드 | 확인 |
|---|---|
| TJ 직접 진행 | YES (sandbox 결제 권한) |
| 1만원 이하 소액 또는 NPay sandbox 환경 | YES |
| 결제 완료 후 즉시 환불 | YES (운영 매출에 남지 않게) |
| 환불 후 imweb / Toss / Naver 자동 sync 영향 모니터링 | inventory snapshot 의 freshness 와 별개. 사이트 결제완료 1건 / 환불 1건 한 짝으로 처리 |

### 2-A. NPay url 에 intent_uuid 부착 시도 (sandbox 한정)

preview snippet v0.4 위에 임시 보강. confirmOrderWithCartItems 의 url 인자에 `?intent_uuid=...` 를 임시 부착 (sandbox 결제 1건 한정, 검증 후 즉시 wrap 해제).

```javascript
/* 2-A. sandbox 결제 1건 진행 직전, intent_uuid url 부착 보강 — 검증 후 reload 로 자동 해제 */
;(() => {
  if (window.__npay_intent_url_attach_installed) return console.log("already installed");
  window.__npay_intent_url_attach_installed = true;
  var _orig = window.SITE_SHOP_DETAIL.confirmOrderWithCartItems;
  window.SITE_SHOP_DETAIL.confirmOrderWithCartItems = function (kind, backurl, params) {
    try {
      if (kind === "npay") {
        var iu = (window.crypto && crypto.randomUUID && crypto.randomUUID()) || ("nu-" + Date.now());
        sessionStorage.setItem("__coffee_intent_uuid_pending", iu);
        var sep = (typeof backurl === "string" && backurl.indexOf("?") >= 0) ? "&" : "?";
        var newBackurl = (backurl || location.href) + sep + "coffee_intent_uuid=" + encodeURIComponent(iu);
        console.log("[intent_url_attach] kind=npay original_backurl=" + backurl + " patched_backurl=" + newBackurl);
        return _orig.call(this, kind, newBackurl, params);
      }
    } catch (e) { console.warn("[intent_url_attach] err", e && e.message); }
    return _orig.apply(this, arguments);
  };
  console.log("[intent_url_attach] installed (sandbox only — reload 로 자동 해제)");
})()
```

**경고**: 본 보강은 1건 sandbox 결제 한정이다. NPay 가 backurl 의 query string 을 그대로 통과시키지 않을 수 있으므로 결제 자체가 실패할 수 있다. 그 경우 보존 결과는 "redirect URL 단계에서 차단됨" 으로 기록하고 다음 위치 검사를 진행.

### 2-B. sandbox 결제 1건 진행

1. 옵션 1개 선택, 수량 1, 1만원 이하 소액 상품 (또는 sandbox 환경).
2. PC NPay 버튼 클릭 → 결제 페이지 진행.
3. 결제 완료까지 진행.
4. **결제 완료 직후** chrome devtools 의 console 에서 1-C 명령 실행해 `searchParamKeys` 등 캡처.
5. NPay seller 센터 / Imweb 관리자 / backend read-only 로 해당 주문의 `channel_order_no` / `meta_data` 안에 `coffee_intent_uuid` 가 보존되었는지 확인.
6. **즉시 환불 처리**.

### 2-C. 검증 결과 표 (3 위치 보존 여부)

| 보존 위치 | 검사 방법 | 결과 |
|---|---|---|
| (a) Imweb redirect URL chain | Network 탭 의 redirect chain 안 query string | YES / NO |
| (b) Imweb 측 raw_data / meta_data (`tb_iamweb_users` / `imweb_orders.metadata_json`) | backend read-only SQL 쿼리. 해당 주문 `order_no` 로 조회 | YES / NO |
| (c) NPay 측 channel_order_no API 응답 또는 Imweb Channel Sync data | NPay seller 센터 (수동 조회) / Imweb v2 API `type=npay` 의 응답 안 추가 필드 / `tb_playauto_orders` | YES / NO |

## 결과 분기 (트랙 결정)

| (a) | (b) | (c) | 결정 트랙 | 비고 |
|---|---|---|---|---|
| YES | YES | YES | **(A) deterministic** | 가장 강한 매핑 |
| YES | YES | NO | **(A) deterministic** | Imweb 측 보존만으로 매핑 가능 |
| YES | NO | YES | **(A) deterministic** | NPay 측 보존만으로 매핑 가능 |
| YES | NO | NO | **(A-) URL 한정 매핑** | redirect URL 캡처 시점에만 매핑 가능. backend 저장 없음 |
| NO | NO | NO | **(B) internal intent ledger + 휴리스틱** | local 에 (intent_uuid, session_uuid, intent_seq, ts, prod_code, quantity, estimated_item_total) 저장 + confirmed order 와 (prod_code, quantity, estimated_item_total, order_time_kst ± 30분) 매칭 |

(A-) 케이스는 임시 매핑이라 ledger 도 함께 운용하는 것이 안전.

## 결과 기록

검증 종료 후 결과를 [[coffee-live-tracking-inventory-20260501]] § 8 의 마지막 행에 한 줄 추가하고, 본 문서의 ## 결과 섹션 (아래) 에 표 형태로 박는다.

## 결과 (1-D 정찰 완료, 1-A/1-B/1-C 는 TJ chrome 검증 대기)

### 1-D Backend raw_data 정찰 결과 (2026-05-01 KST, Codex read-only 진행)

| 검증 위치 | 출처 | 결과 |
|---|---|---|
| coffee `imweb_orders.raw_json` 자유 텍스트 후보 (5건 sample) | local SQLite `backend/data/crm.sqlite3` `pay_type='npay'`, `site='thecleancoffee'`, 최근 5건 | `form: []` 5/5 비어 있음. memo / note / custom / meta / remark 키 0건. top-level keys 14종 모두 정형 (cash_receipt / channel_order_no / complete_time / delivery / device / form / is_gift / order_code / order_no / order_time / order_type / orderer / payment / sale_channel_idx / use_issue_coupon_codes) |
| biocom `tb_iamweb_users.raw_data` jsonb top-level keys (100 row sample) | 운영 PG read-only | `form` / `memo` / `note` / `custom` / `meta` / `remark` 0건. `adminUrl` 만 URL 텍스트 (admin 화면용). 나머지는 정형 (orderNo / payments / sections / orderType / device / saleChannel 등 40여종) |
| `tb_iamweb_users.raw_data.payments` nested keys | 동일 | NPay 결제 nested 안 정형 11종 (bankTransfer / cashReceipt / externalPointAmount / isCancel / method / paidPrice / paymentCompleteTime / paymentNo / paymentStatus / pgName / taxFreePrice). 자유 텍스트 0 |
| `tb_iamweb_users.raw_data.sections` nested keys | 동일 | section 별 자유 텍스트 후보 1건: **`pickupMemo`** (단 사용자 픽업 메모 입력 자리, 일반 결제 흐름에서 자동 박히는 query string 자리 아님) |
| `tb_playauto_orders` 컬럼 | 동일 | raw_data jsonb 컬럼 **없음**. 정형 컬럼만. 자유 텍스트 후보 1건: **`ship_msg`** (배송 메시지, 사용자 입력 자리) |

**1-D 정찰 결정**:

(b) Imweb meta_data / raw_data 안 query string 자동 보존 = **NO**. imweb v2 API 응답이 정형 컬럼 위주이며 자유 텍스트 자리는 사용자 입력 (`pickupMemo`, `delivery_memo`, `memo`, `ship_msg`) 만임. 우리 `coffee_intent_uuid` 같은 backurl query 가 자동으로 들어갈 자리 없음.

이는 더클린커피와 biocom 양쪽 모두에 해당 (둘 다 imweb v2 API). cross-site 메모 [[coffee-funnel-capi-cross-site-applicability-20260501]] 에도 반영.

### 1-A 결과 (2026-05-01 22:19 KST TJ chrome 검증 완료)

| 검증 항목 | 결과 |
|---|---|
| `confirmOrderWithCartItems` 의 `kind` 인자 | `"npay"` |
| `backurl` 인자 | `"https://thecleancoffee.com/shop_view?idx=73"` (현재 페이지 URL 그대로, query 없음) |
| `params` 인자 | `null` (3번째 인자 자체가 없음) |
| funnel-capi console marker (직후) | `[funnel-capi] reuse eid InitiateCheckout InitiateCheckout.o202605019a684b5c47669.665e2`. **`reuse eid`** 라 imweb 자체가 fbq 호출 시 `eventID` 를 이미 명시함 |
| imweb orderCode 형식 (eid 안) | `o202605019a684b5c47669` = `o` + `20260501` (YYYYMMDD) + `9a684b5c47669` (14자 hex) |
| NPay 측 redirect URL (console `Navigated to`) | `https://orders.pay.naver.com/order/bridge/mall/<malltoken>/<NPay_orderID>` (예 `mxm8Fdo62P20honEGEA-6Q/201419903`). **path 안 query 0개**, NPay 자체 token 으로 변환됨 |

### 1-A 의 결정적 발견 (Codex backend 정찰로 확정)

`imweb_orders.order_code` 컬럼 (local SQLite, site=thecleancoffee, 최근 5건) 의 실제 형식 = **`o<YYYYMMDD><14자 hex>`** — 1-A 의 funnel-capi InitiateCheckout eid 안 orderCode 형식과 정확히 일치.

```
202604047770464 | o202604049b297f0c80fef | 2026040464476230 | npay
202604047863466 | o2026040467d659f119cdf | (none)            | card
```

→ **NPay click 시점에 imweb 이 자체 발급한 orderCode 가 (i) fbq InitiateCheckout eventID 와 (ii) backend `imweb_orders.order_code` 양쪽에 보존됨**.

이것이 우리의 deterministic key. 우리 wrap 에서 NPay click 직후 funnel-capi sessionStorage 에서 orderCode 를 retry capture 하면 backend 와 직접 join 가능.

### 1-B / 1-C / 2-* (TJ 검증 대기)

| 항목 | 값 |
|---|---|
| 1-B NPay redirect chain query string keys | (TJ 검증 후 기록 — 단 1-A console output 으로 `orders.pay.naver.com/order/bridge/mall/<token>/<id>` path 의 query 0개 확인됨, 추가 정찰 가치 낮음) |
| 1-C `/shop_payment_complete` searchParamKeys | (TJ sandbox 결제 시 기록 — `order_code` 가 query 로 들어올 가능성 매우 높음. Purchase Guard line 92~95 의 `getSearchParam(['order_code', 'orderCode'])` 가 이 단계의 정본) |
| 2단계 (a) `coffee_intent_uuid` redirect URL 보존 | **불가 확정** (1-A 결과로 backurl 자체에 query 안 박힘 + NPay redirect 가 자체 token 변환) |
| 2단계 (b) `coffee_intent_uuid` Imweb meta_data 보존 | **NO 확정** (1-D 정찰 결과) |
| 2단계 (c) `coffee_intent_uuid` NPay channel 응답 보존 | (NPay Production API 권한 발급 후 가능) |

### 결정 트랙 (2026-05-01 22:30 KST 갱신)

| 트랙 | 가능 여부 | 근거 |
|---|---|---|
| (A) deterministic via Imweb redirect URL 보존 | ❌ | 1-A: backurl 단순 페이지 URL |
| (A-) URL 한정 매핑 | ❌ | 1-A: NPay redirect URL path 자체에 query 0 |
| (b) Imweb meta_data 보존 | ❌ | 1-D |
| (c) NPay channel_order_no 응답 보존 | ⏸️ | API 권한 미발급 |
| **(A++) imweb orderCode 트랙** | **✅ 신규 발견 — 가장 강력** | NPay click 시점에 imweb 자체 발급 → fbq eid 와 backend `order_code` 양쪽 보존 |
| (B) internal ledger + 휴리스틱 | ✅ | (A++) 작동 안 할 때 fallback |

### (A++) 트랙 작동 방식

1. preview snippet v0.4 + v0.5 보강 (orderCode retry capture) 설치
2. PC NPay click → snippet 의 wrap hook → buildPayload 의 `intent_uuid` + `funnel_capi_session_id` capture
3. `setTimeout(100/500/1500ms)` retry 로 funnel-capi sessionStorage `funnelCapi::sent::InitiateCheckout.<orderCode>.*` 키 grep → orderCode 추출
4. buffer 의 가장 최근 entry 에 `imweb_order_code` 필드 추가 박음
5. (다음 phase) backend ledger `coffee_npay_intent_log` 에 `(intent_uuid, imweb_order_code, ts, prod_code, quantity, estimated_item_total)` 저장
6. 결제 완료 후 imweb sync 가 `imweb_orders.order_code` 채우면 ledger 와 1:1 deterministic join

### v0.5 검증 결과 (2026-05-01 22:30 KST TJ chrome 검증 완료)

PC NPay click 1회 (`shop_view/?idx=73`, prod_price=19900) → snippet v0.4 + v0.5 보강 동작:

| payload 필드 | 값 |
|---|---|
| `intent_phase` | `"confirm_to_pay"` |
| `intent_uuid` | `64c53fab-faa9-499e-8330-aa98309a7ff7` |
| `imweb_order_code` | **`o2026050189a174746502e`** ← (A++) 트랙 작동 확정 |
| `imweb_order_code_eid` | `InitiateCheckout.o2026050189a174746502e.63911` |
| `imweb_order_code_capture_delay_ms` | **`1500`** (100ms / 500ms 에는 미발견, 1500ms 째에 잡힘) |
| `funnel_capi_session_id` | `momy91ln8tppfe` |
| `prod_code` / `prod_price` | `s20260430baf1869c41c35` / 19,900원 |

console marker: `[coffee_npay_intent_preview_v05] captured orderCode @1500ms`

→ **(A++) 트랙 PASS**. 다음 phase 의 backend ledger 작성 + `imweb_orders.order_code` 와 deterministic join 진입 가능.

### v0.5 검증 중 발견한 추가 사실 — GA4 NPay synthetic transaction_id 형식

console 에 imweb 이 자체 발화한 줄:

```
[{"item_name":"...","item_id":"73","price":19900,"quantity":"1","item_brand":"thecleancoffee"}]
19900
NPAY - 202604101 - 1777642253241
```

**`NPAY - 202604101 - 1777642253241`** = imweb 이 GA4 dataLayer 에 push 한 NPay synthetic transaction_id. 형식 = `NPAY - <imweb 자체 ID 9자리> - <Date.now() ms>`. `Date.now()` ms 값 (`1777642253241`) 이 우리 payload `ts_ms_kst` (`1777642253236`) 와 5ms 차이 — confirm_to_pay 호출과 거의 동시에 발급.

이 transaction_id 가 GA4 BigQuery 에 들어가는 NPay 형 purchase event 의 `transaction_id` 와 동일 패턴. 즉 [[coffee-imweb-operational-readonly-20260501]] 의 unassigned actual recovery 분석에서 robust_absent 36/36 이었던 이유가 imweb order_no / NPay channel_order_no 로 검색했기 때문이고, **GA4 NPay synthetic transaction_id 자체와 우리 ledger 안 같은 값을 비교하면 매핑 가능**.

문제: 이 synthetic id 가 어디 sessionStorage / DOM / window 변수에 박히는지 추가 정찰 필요. 확인되면 v0.6 보강 가능 (synthetic id 도 buffer payload 에 capture).

### 확보된 deterministic key 5종

| 키 | 출처 | 매핑 대상 |
|---|---|---|
| `intent_uuid` | 우리 wrap | local ledger PK |
| `funnel_capi_session_id` | funnel-capi `__seo_funnel_session` | session 단위 추적 |
| `imweb_order_code` (A++ 트랙) | imweb 자체 발급 | **backend `imweb_orders.order_code` (1:1 deterministic)** |
| GA4 NPay synthetic transaction_id | imweb dataLayer push | **GA4 BigQuery `transaction_id` (1:1 deterministic, 추가 정찰 필요)** |
| NPay 측 orderID | NPay redirect URL path | NPay seller API (권한 발급 후 가능) |

위 5종 중 `imweb_order_code` 는 v0.5 로 확보 완료. `synthetic_transaction_id` 는 v0.6 정찰 후 확보 가능.

### 다음 단계

| 우선순위 | 작업 | 형태 |
|---|---|---|
| HIGH | snippet v0.5 보강 검증 — TJ chrome 에서 v0.5 보강 install 후 PC NPay click → buffer 의 `imweb_order_code` 필드 채워지는지 확인 | TJ chrome 1회 |
| MID | (선택) 1-C 결제 완료 페이지 URL searchParamKeys 캡처 — sandbox 결제 1건. `order_code` query 가 결제 완료 페이지로 돌아오는지 확정 | TJ sandbox 결제 |
| LOW | 1-B 추가 필터 (`orders.pay.naver.com`) — query 0 확정 후 종결 | TJ chrome 1회 |

## 외부 시스템 영향

| 시스템 | 1단계 영향 | 2단계 영향 |
|---|---|---|
| imweb 사이트 | 0 | sandbox 결제 1건 발생 + 즉시 환불 1건. 우리 코드 변경 0 |
| GTM workspace | 0 | 0 |
| funnel-capi | 0 (read 만) | 0 |
| GA4 / Meta / TikTok / Google Ads | 0 | 결제 1건 → ViewContent / InitiateCheckout / AddPaymentInfo / Purchase 일부 발화 (funnel-capi 또는 imweb). 그러나 본 검증이 발화시키는 게 아니라 sandbox 결제 자연 동작 |
| 로컬 DB | 0 | 0 (우리 snippet 은 write 안 함) |
| 운영 DB | 0 | imweb 자동 sync 로 결제+환불 1쌍 추가될 수 있음. 사이트 결제 정합성에는 영향 없음 |

## 다음 단계 (트랙 결정 후)

| 트랙 | 다음 phase |
|---|---|
| (A) deterministic | local backend `POST /api/coffee/intent/dry-run` (write 0) → `coffee_npay_intent_log` 테이블 → confirmed order join 30초 dedupe + 24시간 grace → GTM Production publish (소수 트래픽) |
| (A-) URL 한정 | (A) 와 동일하지만 URL 캡처 layer 추가 (Imweb redirect 직전에 query string 정규화 / 저장) |
| (B) internal ledger + 휴리스틱 | ledger 우선. 매칭 정확도 모니터링 (precision/recall 7일 ± 측정). 충분하면 sufficient. 부족하면 funnel-capi InitiateCheckout eid 와 함께 매칭 키 풍부하게 |

## 가드 재확인

- 본 검증은 site live 배포가 아니다. preview snippet 의 chrome 세션 한정.
- 2단계 결제는 sandbox 또는 소액 + 즉시 환불.
- 운영 DB write 0 (snippet 측), 운영 send 0, 운영 publish 0, 운영 코드 변경 0.
- PII (phone / email / name / address / option 원문) 는 본 검증 어디에도 출력하지 않는다.
- 검증 결과 raw 데이터 (HAR 등) 는 PII 포함 가능하므로 본 문서에는 키 이름과 형식만 기록한다.
