# 더클린커피 NPay Intent Beacon Preview-only 설계안

생성 시각: 2026-05-01 KST
site: `thecleancoffee`
mode: `design_only` / `preview_only`
범위: DOM selector 조사 + beacon payload 초안 + preview 검증 절차
관련 Sprint: [[!coffeedata#Phase2-Sprint5|Phase2-Sprint5]] / [[!coffeedata#Phase3-Sprint6|Phase3-Sprint6]] / [[!coffeedata#Phase4-Sprint8|Phase4-Sprint8]]

## Auditor Verdict

```text
Auditor verdict: PASS_WITH_NOTES
Phase: coffee_npay_intent_beacon_preview_design
No-send verified: YES
No-write verified: YES
No-deploy verified: YES
GTM publish: BLOCKED
Live script injection: BLOCKED
PII output: NONE
New executable send path added: NO
Actual network send observed: NO
```

## 10초 요약

더클린커피 NPay 버튼 클릭은 PC/Mobile 모두 결국 `SITE_SHOP_DETAIL.confirmOrderWithCartItems("npay", url)` 단일 함수로 수렴한다. 따라서 button selector 위임이 아니라 이 함수를 wrap 하는 방식이 가장 안정적이다.

이번 설계는 preview only다. 실제 GTM publish, head 삽입, payload 외부 전송은 전부 금지하며, sessionStorage 버퍼와 console.log 만 사용한다.

## 목적

- 과거분 (GA4 synthetic transaction_id) 자동 매칭이 약한 문제를 미래분에서 닫는다.
- NPay 버튼 클릭 → 실제 결제완료 사이의 의도(intent)를 site 단에서 확정해 둔다.
- intent 단계에서 실제 주문번호와 매칭할 수 있는 deterministic key 를 만들어 둔다 (`prod_code` + `client_id` + `ga_session_id` + `local_uuid`).
- 다만 이번 phase 는 **설계 + DOM 조사 + preview 검증 절차** 까지만이고, 데이터 저장/광고 전송/운영 publish 는 별도 승인이 필요하다.

## 조사 결과: 더클린커피 NPay 버튼 DOM 구조

조사 페이지: `https://thecleancoffee.com/shop_view/?idx=1` (대표 상품 1)
조사 방법: `curl -L -s` 로 정적 HTML 받아 grep, no JS execution.

### PC NPay 버튼

```html
<div id='naverPayWrap'>
  <!-- Naver SDK 가 런타임에 button 을 여기 삽입 -->
</div>
```

- selector: `#naverPayWrap` (안정 ID)
- 실제 button 은 `naver.NaverPayButton.apply(...)` 가 SDK iframe 또는 sub-element 로 그림
- DOM 안 button 자체에는 `data-bs-action`, `data-bs-content`, `data-bs-payment-button-type` 가 없음 → selector click 위임 어려움
- 진입 핸들러 (script 내 inline):

```javascript
naver.NaverPayButton.apply({
  BUTTON_KEY: "AF46D07A-5C19-4759-B0E9-AEEEC897653C",
  TYPE: "B", COLOR: 1, COUNT: 2,
  EMBED_ID: embed_id,
  ENABLE: "Y",
  BUY_BUTTON_HANDLER: function () {
    SITE_SHOP_DETAIL.trackClickPurchaseShopView("naverpay");
    SITE_SHOP_DETAIL.confirmOrderWithCartItems("npay",
      "https://thecleancoffee.com/shop_view/?idx=1");
  },
  WISHLIST_BUTTON_HANDLER: function () { SITE_SHOP_DETAIL.addNPayWish(); }
});
```

- 결국 PC 도 `SITE_SHOP_DETAIL.confirmOrderWithCartItems("npay", url)` 한 줄로 수렴.

### Mobile NPay 버튼

```html
<div class="cart_btn n_pay width-50">
  <a href="javascript:;"
     class="_btn_mobile_npay btn button button--pay button--padding naver"
     onclick="SITE_SHOP_DETAIL.showMobileOptions('buy')">
    <img alt="네이버페이" src=".../npay_logo.svg" />
  </a>
</div>
```

- selector 후보:
  - `.cart_btn.n_pay` (NPay 사용 시에만 추가되는 컨테이너 클래스, 주석에 표기됨)
  - `._btn_mobile_npay` (실제 버튼)
  - `a.button.naver` (mobile NPay 버튼은 `naver` 클래스 동시 보유)
- `_btn_mobile_npay` 클릭은 `showMobileOptions('buy')` 로 옵션 다이얼로그 오픈만 한다. 다이얼로그 안 NPay 확인 클릭에서 `naver.NaverPayButton.apply` 핸들러를 거쳐 `confirmOrderWithCartItems("npay", url)` 가 호출된다.
- 따라서 mobile 도 PC 와 동일하게 `confirmOrderWithCartItems("npay", url)` 가 단일 진입점이다.

### 비교: imweb_payment 구매 버튼

```html
<a class="btn buy bg-brand _btn_buy"
   data-dd-action-name="init-checkout"
   data-bs-action="click"
   data-bs-content="purchase"
   data-bs-where="shop_view"
   data-bs-payment-button-type="imweb_payment"
   data-bs-prod-code="s20190901240a23893fa08"
   data-bs-prod-type="normal"
   data-bs-is-regularly-prod="false"
   onclick="SITE_SHOP_DETAIL.selectFreebieAsync().then(function(selected_freebies) {
     SITE_SHOP_DETAIL.confirmOrderWithCartItems('guest_login',
       'https://thecleancoffee.com/shop_view/?idx=1', {selected_freebies})
   });">구매하기</a>
```

- imweb_payment 경로는 `confirmOrderWithCartItems('guest_login', ...)` 로 분기되는 1번째 인자만 다르다.
- 따라서 함수 wrap 시 1번째 인자가 `'npay'` 인 호출만 NPay intent 로 분류 가능.

### 페이지/상품 메타데이터 추출 가능 위치

```javascript
SITE_SHOP_DETAIL.initDetail({
  "prod_idx": 1,
  "prod_code": "s20190901240a23893fa08",
  "prod_price": 21900,
  "options_hash": "e06ff5b...",
  "require_option_count": 2,
  ...
});
```

- `SITE_SHOP_DETAIL.initDetail({prod_idx, prod_code, prod_price})` 가 페이지 로드 시 1회 실행되므로, beacon 안에서 `prod_code`/`prod_idx`/`prod_price` 를 동시 캡처 가능.

## Selector 옵션 비교

| 옵션 | 위치 | 장점 | 단점 | 채택 |
|---|---|---|---|---|
| A) `#naverPayWrap` 클릭 위임 | PC | 안정 ID | SDK 가 iframe 으로 그릴 가능성, click 이벤트가 wrap 까지 bubble 안 될 수 있음 | 비채택 |
| B) `._btn_mobile_npay` listener | Mobile only | DOM 명확 | PC 미커버, dialog 안 NPay 확정 click 누락 위험 | 보조 |
| C) `naver.NaverPayButton.apply` 호출 가로채기 | 공통 | SDK 진입점 | Naver SDK 변경 시 쉽게 깨짐 | 비채택 |
| D) `SITE_SHOP_DETAIL.confirmOrderWithCartItems` wrap | 공통 | PC/Mobile/dialog 전부 통과, 1번째 인자로 NPay 식별 | imweb 내부 함수라 prefix/이름 변경 시 깨짐 (모니터링 필요) | **채택** |

권장 패턴: **D 우선 + B 백업**. D 가 함수 wrap 이라 click 이벤트 누락이 없고, B 는 click 만 잡혀도 intent 로 인정해야 하는 케이스 (다이얼로그 안 NPay 확정 안 누른 채 이탈) 식별에 필요.

## Beacon Payload 초안 (PII 제외)

```typescript
type CoffeeNpayIntentBeacon = {
  site: "thecleancoffee";        // hardcoded
  intent_phase: "click_to_dialog" | "dialog_to_npay" | "confirm_to_pay";
  prod_idx: number;              // SITE_SHOP_DETAIL.initDetail
  prod_code: string;             // SITE_SHOP_DETAIL.initDetail
  prod_price: number;            // SITE_SHOP_DETAIL.initDetail
  selected_option_count: number; // length only, 옵션값 자체는 저장 안 함
  ga_client_id: string;          // _ga cookie 의 cid (해시 안 함, GA4 와 동일 키)
  ga_session_id: string;         // _ga_<G-XXX> cookie 의 session_id
  intent_uuid: string;           // crypto.randomUUID() 1회 발급 후 sessionStorage 보관
  page_url: string;              // location.href, query string 그대로 (PII 없음)
  page_path: string;             // location.pathname
  payment_button_type: "npay";   // wrap 의 1번째 인자 'npay' 일 때만 채움
  ts_ms_kst: number;             // Date.now() 그대로 (UTC 기준)
  ts_label_kst: string;          // KST ISO label, debug 용
  user_agent_class: "pc" | "mobile" | "unknown"; // matchMedia
  preview_only: true;            // 항상 true. 절대 false 로 못 가게 가드
};
```

PII 차단 규칙:
- 전화번호, 이메일, 주문자명, 배송지 주소: **수집 금지**
- option 텍스트, option 가격, option key: 수집 금지 (count 만)
- referrer 의 query string 안 식별자 (`utm_*` 외): 차단

## 저장/전송 (preview only)

- ❌ `navigator.sendBeacon` / `fetch` / `XMLHttpRequest` 외부 전송 금지
- ❌ GA4 `gtag('event', ...)` 호출 금지
- ❌ Meta CAPI / TikTok Events API 직접 호출 금지
- ❌ 내부 backend (`/api/...`) 호출 금지
- ✅ `sessionStorage.setItem('coffee_npay_intent_preview', JSON.stringify(buffer))` 로 buffer 만 (검수용)
- ✅ `console.log('[coffee_npay_intent_preview]', payload)` 로 devtools 확인
- ✅ buffer 는 최대 50개, 초과 시 FIFO drop, beforeunload 에서도 외부 전송 안 함

## Preview 코드 초안 (devtools snippet 형태, GTM/live publish 금지)

```javascript
// CoffeeNpayIntentPreview v0 — preview only
(function () {
  if (window.__coffeeNpayIntentPreview) return;
  window.__coffeeNpayIntentPreview = true;

  const SITE = "thecleancoffee";
  const STORAGE_KEY = "coffee_npay_intent_preview";
  const MAX_BUFFER = 50;

  const readBuffer = () => {
    try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "[]"); }
    catch { return []; }
  };
  const writeBuffer = (buf) => {
    while (buf.length > MAX_BUFFER) buf.shift();
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(buf));
  };

  const intentUuid = (() => {
    const k = "coffee_npay_intent_uuid";
    let v = sessionStorage.getItem(k);
    if (!v) {
      v = (window.crypto?.randomUUID?.() ??
        `nu-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      sessionStorage.setItem(k, v);
    }
    return v;
  })();

  const readGaIds = () => {
    const cookies = Object.fromEntries(
      document.cookie.split(";").map((s) => s.trim().split("=").map(decodeURIComponent))
    );
    const ga = cookies["_ga"] ?? "";
    const cid = ga.split(".").slice(2).join(".") || "";
    const gaSessionEntry = Object.entries(cookies)
      .find(([k]) => k.startsWith("_ga_"))?.[1] ?? "";
    const sessionId = gaSessionEntry.split(".")[2] ?? "";
    return { cid, sessionId };
  };

  const detectUaClass = () => {
    if (window.matchMedia?.("(max-width: 768px)").matches) return "mobile";
    if (window.matchMedia?.("(min-width: 769px)").matches) return "pc";
    return "unknown";
  };

  const buildPayload = (phase) => {
    const detail = window.SITE_SHOP_DETAIL?._initDetailArgs ?? {};
    const { cid, sessionId } = readGaIds();
    return {
      site: SITE,
      intent_phase: phase,
      prod_idx: Number(detail.prod_idx ?? 0),
      prod_code: String(detail.prod_code ?? ""),
      prod_price: Number(detail.prod_price ?? 0),
      selected_option_count: Number(
        document.querySelectorAll("#prod-form-options ._option_select_row").length || 0
      ),
      ga_client_id: cid,
      ga_session_id: sessionId,
      intent_uuid: intentUuid,
      page_url: location.href,
      page_path: location.pathname,
      payment_button_type: "npay",
      ts_ms_kst: Date.now(),
      ts_label_kst: new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }),
      user_agent_class: detectUaClass(),
      preview_only: true
    };
  };

  const log = (payload) => {
    const buf = readBuffer();
    buf.push(payload);
    writeBuffer(buf);
    console.log("[coffee_npay_intent_preview]", payload);
  };

  // a) initDetail wrap to remember args (preview only, no override)
  const _origInit = window.SITE_SHOP_DETAIL?.initDetail;
  if (typeof _origInit === "function") {
    window.SITE_SHOP_DETAIL.initDetail = function (args) {
      window.SITE_SHOP_DETAIL._initDetailArgs = args;
      return _origInit.apply(this, arguments);
    };
  }

  // b) confirmOrderWithCartItems wrap — single entry point
  const _origConfirm = window.SITE_SHOP_DETAIL?.confirmOrderWithCartItems;
  if (typeof _origConfirm === "function") {
    window.SITE_SHOP_DETAIL.confirmOrderWithCartItems = function (kind) {
      try {
        if (kind === "npay") log(buildPayload("confirm_to_pay"));
      } catch (err) { console.warn("[coffee_npay_intent_preview] error", err); }
      return _origConfirm.apply(this, arguments);
    };
  }

  // c) mobile click backup
  document.addEventListener("click", (event) => {
    const el = event.target instanceof Element ? event.target.closest("._btn_mobile_npay") : null;
    if (!el) return;
    try { log(buildPayload("click_to_dialog")); }
    catch (err) { console.warn("[coffee_npay_intent_preview] error", err); }
  }, true);

  console.log("[coffee_npay_intent_preview] installed (preview only, no network send)");
})();
```

이 코드는 chrome devtools snippet 또는 GTM Preview workspace 안에서만 실행한다. 절대 production GTM workspace publish 또는 imweb head 삽입에 들어가지 않는다.

## Preview 검증 절차

1. **준비**: chrome 시크릿 창 + devtools open + Sources > Snippets 에 위 코드 붙여넣기.
2. **시나리오**:
   - PC: `https://thecleancoffee.com/shop_view/?idx=1` 진입 → snippet 실행 → 옵션 1개 선택 → NPay 버튼 클릭. devtools console 에 `confirm_to_pay` payload 1건 떠야 함.
   - Mobile: chrome devtools mobile emulation iPhone 12 → 같은 페이지 → 옵션 선택 → mobile NPay 버튼 클릭 → 다이얼로그 → 다이얼로그 NPay 확정. console 에 `click_to_dialog` 1건 + `confirm_to_pay` 1건.
   - imweb_payment 비교: PC 일반 구매하기 클릭. **`payment_button_type:'npay'` 가 아니므로 buffer 에 들어가지 않아야** 한다.
   - 옵션 미선택: NPay 버튼 클릭 시 imweb 가 옵션 선택 alert 띄우면 우리 hook 까지 도달 안 해야 함. console 에 1건 들어오면 false positive 표시.
   - 비공개/품절: 버튼 미노출 또는 disabled 인 경우 click handler 미호출 확인.
3. **payload PII 점검**: console payload 안에 `phone`, `email`, `addr`, `name` 키가 없는지 grep. `selected_option_count` 는 숫자만이어야 함.
4. **외부 송출 없음 확인**: devtools Network 탭 필터 `pay.naver|google-analytics|facebook|tiktok|api/coffee` → snippet 으로 인한 새 request 가 0 이어야 함.
5. **종료**: snippet 종료 (페이지 reload). sessionStorage 의 `coffee_npay_intent_preview` 가 자동 소멸.

## Live 배포 금지 가드

- GTM Coffee workspace: **publish 금지**. preview 로만 검증.
- imweb 사이트 head/footer custom script 직접 추가: **금지**. 별도 phase 에서 TJ 승인 후 진행.
- backend 로 beacon 송출: **금지**. 송출은 GA4/Meta/TikTok 전환 전송 승인 게이트와 별도로 추가 phase 가 필요.
- 본 문서 base 의 코드는 "preview snippet" 으로만 표시한다. 본 코드를 실 배포 코드로 복사하면 Auditor verdict FAIL.

## 다음 단계 (별도 phase, 본 phase 범위 외)

| 단계 | 트리거 | 산출물 |
|---|---|---|
| Step 1 | 본 design 승인 | snippet preview 결과 1회 기록 (시나리오 5개) |
| Step 2 | preview 결과 PASS | GTM Preview workspace 에 snippet 동일 코드를 Custom HTML tag 로 등록 (workspace publish 금지) |
| Step 3 | GTM Preview PASS | local backend `POST /api/coffee/intent/dry-run` 추가 (write 안 함, payload 만 검증) |
| Step 4 | dry-run PASS | local SQLite `coffee_npay_intent_log` 테이블 추가 + write 로컬에서만 |
| Step 5 | local store PASS + TJ 승인 | confirmed order join 30초 dedupe + 24시간 grace 기준 적용 |
| Step 6 | 정합성 7일 모니터링 | GTM Production workspace publish (이때부터 site live) |
| Step 7 | live PASS + ROAS 정합성 | GA4/Meta CAPI 보강 전송 승인 게이트 별도 진행 |

## 외부 시스템 영향

- imweb 사이트: 변경 없음 (이번 phase 는 head/footer 미수정).
- GTM workspace: workspace 변경 없음 (preview snippet 만, publish 없음).
- GA4/Meta/TikTok: 신규 이벤트 송출 없음.
- 로컬 DB: 신규 테이블 없음.
- 외부 API: 신규 호출 없음.

## 변경되는 동작

본 design 적용으로 인해 production 동작은 0건 변경된다. preview snippet 을 실행하는 chrome 세션에서만:

- `window.SITE_SHOP_DETAIL.initDetail` 이 wrap 되어 `_initDetailArgs` 가 추가됨.
- `window.SITE_SHOP_DETAIL.confirmOrderWithCartItems` 가 wrap 되어 `kind === "npay"` 호출 시 sessionStorage 에 payload 저장.
- `_btn_mobile_npay` click 이벤트가 capture 단계에서 잡힘.

이 모든 변경은 페이지 reload 시 사라지고 영구 저장소에 남지 않는다.

## 관련 문서

- [[coffee-imweb-operational-readonly-20260501]] — 현재 unassigned actual 18 / ambiguous 29 분류
- [[coffee-excel-ltv-dry-run-20260501]] — 2024/2025 LTV dry-run
- [[coffee-npay-unassigned-ga4-guard-20260501]] — robust_absent 36/36
- [[harness/coffee-data/RULES|Coffee Rules]]
- [[!coffeedata#Phase3-Sprint6|!coffeedata § Phase3-Sprint6]]
