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

| 검사 항목 | 위치 |
|---|---|
| `pay.naver.com/customer/...` 결제 페이지 진입 url | NPay 결제 redirect URL. query string 에 imweb 측 param 이 어떻게 박혀 가는지 |
| `pay.naver.com/...` 응답 안 form action / hidden input | 결제 form 의 hidden field 안 imweb param 들 |
| imweb 측 `/shop_payment_complete?...` 또는 `/shop_order_done?...` 복귀 url | 결제 완료 후 imweb 이 받는 query string |

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

## 결과 (검증 후 채움)

| 항목 | 값 |
|---|---|
| 검증 시각 | (TJ 검증 후 기록) |
| 1단계 (a) Imweb redirect URL keys | (예: `[order_no, order_code, payment_key, ...]`) |
| 1단계 (c) `/shop_payment_complete` searchParamKeys | (검증 후 기록) |
| 2단계 (a) `coffee_intent_uuid` redirect URL 보존 | YES / NO |
| 2단계 (b) `coffee_intent_uuid` Imweb meta_data 보존 | YES / NO |
| 2단계 (c) `coffee_intent_uuid` NPay channel 응답 보존 | YES / NO |
| 결정 트랙 | (A) / (A-) / (B) |
| 다음 phase 트리거 | (트랙별 액션) |

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
