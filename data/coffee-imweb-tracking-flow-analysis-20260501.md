# 더클린커피 Imweb 헤더/푸터 코드 4 Layer Tracking Flow 분석

생성 시각: 2026-05-01 KST
site: `thecleancoffee`
mode: `read_only` / 정본 코드 분석 (실행/네트워크 호출 없음)
정본 출처: [[coffee/!imwebcoffee_code_latest_0501|imweb 헤더/푸터 코드 latest 0501]] 총 2,292행
관련 문서: [[coffee-live-tracking-inventory-20260501]], [[coffee-npay-intent-beacon-preview-design-20260501]], [[!coffeedata#Phase3-Sprint6|!coffeedata § Phase3-Sprint6]]

## Auditor Verdict

```text
Auditor verdict: PASS_WITH_NOTES
Phase: coffee_imweb_tracking_flow_analysis
No-send verified: YES
No-write verified: YES
No-deploy verified: YES
No-publish verified: YES
GTM publish: BLOCKED
Live script injection: BLOCKED
fetch/sendBeacon/XHR: BLOCKED (read-only 정본 코드 분석만)
GA4 gtag event / Meta CAPI / TikTok Events / Google Ads send: BLOCKED
backend API call: BLOCKED
sessionStorage + console.log only: N/A (no execution)
PII output: NONE
실제 운영 변경: 0건
```

## 10초 요약

더클린커피 imweb 헤더/푸터 4 layer 의 NPay 결제 흐름 트리거/이벤트/시간 순서를 정본 코드에서 직접 추적했다. 결정적 발견은 **NPay 결제 흐름에서 `checkout-started v1` 단계가 trigger 조건상 의도적으로 비어 있다**는 점이다. 즉 NPay click ~ 결제 완료 페이지 복귀 사이의 attribution context 가 비어 있고, 이것이 정확히 우리 NPay intent beacon design 이 보강해야 할 영역이다.

## 4 Layer 구조 요약

| # | layer | line 범위 | snippet version | trigger 조건 | 발화/저장 동작 | fb event 발화 |
|---|---|---|---|---|---|---|
| 1 | Purchase Guard v3 | 12~946 | `2026-04-14-coffee-server-payment-decision-guard-v3` | `path.indexOf('shop_payment_complete') >= 0 \|\| path.indexOf('shop_order_done') >= 0` | fbq Purchase 호출 가로채서 `att.ainativeos.net/api/attribution/payment-decision` 호출 후 `allow_purchase` / vbank / unknown / blocked 분기. fallback image pixel 호출 가능 | `Purchase` (allow 시 원본 발화), `VirtualAccountIssued`, `PurchaseDecisionUnknown`, `PurchaseBlocked` (custom) |
| (보조) | 헤더코드 GTM/RUM | 947~978 | — | shop_cart 도착 시 Google Ads conversion + GTM-5M33GC4 inject + beusable RUM | gtag conversion `AW-304339096/Xq1KCMTrt4oDEJixj5EB` (장바구니 추가) | (Google Ads 별도 layer) |
| (보조) | 바디코드 | 979~994 | — | GTM noscript + Uneedcomms KeepGrow init | KAKAO Sync 활성화 | — |
| 2 | checkout-started v1 | 1185~1559 | `2026-04-14-coffee-checkout-started-v1` | `isCheckoutCandidate()` = `/shop_order\|shop_payment\|order_form\|checkout/` 매치 **AND** `/shop_payment_complete\|shop_order_done\|order_complete\|payment_complete/` 미매치. **즉 결제 진입 페이지 한정, 결제 완료 페이지 제외** | sessionStorage `__seo_checkout_id` 발급 (`chk_<ts>_<random>`), `__seo_checkout_context` 저장. backend `att.ainativeos.net/api/attribution/checkout-context` 로 ga_session_id, client_id, user_pseudo_id, utm_*, gclid/fbclid/ttclid/fbc/fbp 전송 | **fbq 호출 안 함** — 별도 attribution layer |
| 3 | payment-success-order-code v1 | 1561~2021 | `2026-04-14-coffee-payment-success-order-code-v1` | `location.href.indexOf('shop_payment_complete') >= 0 \|\| location.href.indexOf('shop_order_done') >= 0` (Purchase Guard 와 동일) | URL/referrer 에서 `orderCode` / `orderId` / `paymentKey` 추출, `__seo_checkout_context` 의 checkoutId 와 매핑해 backend `att.ainativeos.net/api/attribution/payment-success` 로 전송. metadata 에 `browser_purchase_event_id: 'Purchase.<orderCode>'` 명시 | **fbq 호출 안 함** |
| 4 | funnel-capi v3 | 2042~2292 | `2026-04-15-thecleancoffee-funnel-capi-v3` | 무조건 wrap (fbq 가 로드되면 100ms 폴링으로 wrap, 최대 ~8초). pixelId 부재 시 abort | window.fbq 를 wrap 해서 `track <EventName>` 중 MIRROR_EVENTS 4종에만 eid 주입 + serverMirror (server CAPI 현재 disabled). `Purchase` 는 MIRROR_EVENTS 의도적 제외 (Purchase Guard v3 단독 관리) | `ViewContent` / `AddToCart` / `InitiateCheckout` / `AddPaymentInfo` 의 eid 주입 (mirror) |

## fbq wrap 중첩 순서

정본 line 2249~2274 의 마커 보존 로직을 보면 **Purchase Guard v3 가 funnel-capi v3 보다 먼저 박혔다**. 즉 호출 체인:

```
imweb 또는 GTM tag
   ↓ fbq('track', 'Purchase' or 'ViewContent' or ..., payload)
funnel-capi wrap (mirror)
   - MIRROR_EVENTS 매치 → eid 주입 + serverMirror
   - 그 외 → 통과
   ↓ orig.apply(this, args)
Purchase Guard wrap (allow_purchase decision 시 통과, 그 외 차단/custom)
   ↓ raw fbq
HTTP /tr/?...
```

`window.fbq.toString()` 결과에 funnel-capi 코드가 보이는 이유는 funnel-capi 가 가장 바깥쪽 wrap 이기 때문이다. Purchase Guard 코드는 `__THECLEANCOFFEE_SERVER_PAYMENT_DECISION_GUARD_RAW__` 속성에 보존되어 있다.

## NPay 결제 흐름 Timeline (정본 코드 기반)

| 시각 | 이벤트 | 어느 layer | 발화/저장 |
|---|---|---|---|
| T0 | 사용자 `/shop_view/?idx=1` 진입 | imweb 자체 또는 GTM | `fbq('track', 'ViewContent', {content_ids:['1'], value:'21900.00', ...})` |
| T0+ε | funnel-capi wrap 통과 | funnel-capi v3 | console: `[funnel-capi] inject eid ViewContent ViewContent.1.<sessionId>` + sessionStorage `funnelCapi::sent::ViewContent.1.<sessionId>` 저장. server CAPI disabled 라 `[funnel-capi] server skipped (disabled)` |
| T1 | 사용자 PC NPay 버튼 click | NPay SDK BUY_BUTTON_HANDLER | `SITE_SHOP_DETAIL.trackClickPurchaseShopView('naverpay')` + `SITE_SHOP_DETAIL.confirmOrderWithCartItems('npay', url)` |
| T1+ε | imweb thin wrapper → 글로벌 `confirmOrderWithCartItems` | imweb 자체 | NPay 결제 form/redirect URL 생성 후 location 변경. **헤더/푸터 4 layer 어느 것도 NPay click 자체를 추적 안 함** |
| T2 | 페이지 redirect → NPay 결제 페이지 (`pay.naver.com` 외부) | NPay | site live 컨텍스트 떠남. 우리 sessionStorage 는 origin 같으면 살아 있지만 외부 도메인이라 접근 불가 |
| T3 | 결제 완료 후 `/shop_order_done?...` 또는 `/shop_payment_complete?...` 복귀 | imweb | URL search params 에 `order_code`, `order_no`, `payment_key` 등 포함 |
| T3+ε | **checkout-started v1 trigger 안 됨** | checkout-started v1 | `isCheckoutCandidate()` 가 `shop_payment_complete\|shop_order_done` 패턴 제외 → return |
| T3+ε | payment-success v1 trigger | payment-success v1 | backend `payment-success` endpoint 호출. payload 에 orderCode/paymentKey/fbc/fbp/utm_*/gclid/fbclid/ttclid/`__seo_checkout_context` 의 checkoutId 등 |
| T3+ε | Purchase Guard v3 활성 | Purchase Guard v3 | fbq Purchase 호출이 들어오면 가로채서 backend `payment-decision` query 후 분기 |
| T3+δ | imweb 또는 GTM 이 fbq Purchase 호출 | (imweb/GTM) | `fbq('track', 'Purchase', {value, currency, ...}, {eventID: 'Purchase.<orderCode>'})` |
| T3+δ+ε | funnel-capi wrap 통과 | funnel-capi v3 | **Purchase 는 MIRROR_EVENTS 제외이므로 통과만**. eid 주입/서버 mirror 0 |
| T3+δ+ε | Purchase Guard wrap 통과 | Purchase Guard v3 | decision = allow_purchase → 원본 fbq 호출. 그 외 → custom (`VirtualAccountIssued` / `PurchaseDecisionUnknown` / `PurchaseBlocked`). 1.8초 후 network observe → 발화 누락 시 image pixel fallback |

## 일반 imweb (PG) 결제 vs NPay 결제 차이

| step | 일반 PG (Toss 등) | NPay |
|---|---|---|
| `ViewContent` (funnel-capi mirror) | YES | YES |
| 결제 진입 페이지 | `/shop_order`, `/shop_payment` (imweb 도메인 안) | `pay.naver.com` (외부 도메인) |
| **checkout-started v1 trigger** | **YES** (`__seo_checkout_id` 발급, backend 전송) | **NO** (외부 도메인이라 imweb 코드 실행 안 됨) |
| `__seo_checkout_id` 발급 시점 | 결제 진입 페이지 진입 시 | **결제 완료 페이지 진입 후 비어 있음** |
| imweb fbq InitiateCheckout/AddPaymentInfo (있다면) → funnel-capi mirror | YES (외부 페이지 진입 전 imweb 안에서) | **NO** (NPay 외부 페이지에서는 imweb 코드 실행 0) |
| `/shop_order_done` 또는 `/shop_payment_complete` 복귀 | YES | YES |
| payment-success v1 trigger | YES | YES |
| Purchase Guard v3 | YES | YES |
| `fbq Purchase` (Purchase Guard 가 분기 후) | YES (allow_purchase 시) | YES (allow_purchase 시) |

**핵심**: NPay 결제는 checkout-started 단계와 그 사이의 InitiateCheckout/AddPaymentInfo fb event 가 의도적/구조적으로 비어 있다.

## NPay 결제에서 비어 있는 영역 (4 layer 가 채우지 않는 것)

1. **NPay click 자체 추적**: NPay 버튼 click 이 BUY_BUTTON_HANDLER 까지 도달했는지, 어느 상품/금액으로 시도했는지, sessionId 와 결합한 deterministic key
2. **NPay click → 결제 완료 페이지 복귀 사이의 attribution context**: 일반 결제는 checkout-started v1 이 `__seo_checkout_id` 를 발급해 backend 매핑하지만, NPay 는 이 시점이 비어 있어 server attribution 가 NPay 결제만 따로 추적 못 함
3. **NPay 결제의 InitiateCheckout/AddPaymentInfo fb event**: 일반 결제 흐름에서 imweb/GTM 이 발화한다면 funnel-capi 가 mirror 하지만, NPay 는 외부 도메인이라 발화 자체 없음

## 우리 NPay Intent Beacon 의 보강 위치 (design v0.4 정당화)

| 비어 있는 영역 | 우리 design 이 채우는 방식 |
|---|---|
| NPay click 자체 추적 | `confirmOrderWithCartItems('npay', url)` wrap (thin wrapper + 글로벌 함수 둘 다) → click 시 buffer 1건 추가, 상품/금액/시간/intent_uuid/intent_seq 기록 |
| NPay 결제 시도 단위 first-party correlation key | `intent_uuid` per `confirm_to_pay` (funnel-capi eid 는 결제 시도 단위 unique 가 아니라 contentKey 단위라 부적합) |
| sessionId | funnel-capi `__seo_funnel_session` **재사용** (새로 발급 안 함) |
| NPay click 시점 attribution 정보 (utm_*, gclid, fbclid, ttclid) | `_ga` cookie + `_fbp` + 사용 가능한 것만 buffer 에 박음. PII 차단 유지 |
| 결제 완료 후 매핑 | url 에 `intent_uuid` query param 부착 → Imweb redirect URL 또는 NPay channel_order_no 에 보존되는지 sandbox 검증 (별도 phase). 보존 안 되면 ledger + `(prod_code, quantity, estimated_item_total, order_time_kst ± 30분)` 휴리스틱 매칭 |

## design v0.4 결정 근거 (코드 line 인용)

| 결정 | 근거 line |
|---|---|
| `session_uuid` helper 는 `sessionStorage.getItem('__seo_funnel_session')` 우선, 부재 시 fallback | 정본 line 2102~2112 |
| `intent_uuid` 는 별도 발급 유지 (funnel-capi eid 재사용 불가) | line 2147 (eid = `<EventName>.<contentKey>.<sessionId>`, 같은 상품 같은 세션 다중 시도 시 동일) |
| 글로벌 `window.confirmOrderWithCartItems` 도 동시 wrap | thin wrapper 구조 (정본 [[coffee-live-tracking-inventory-20260501]] §4 진단 A 결과) |
| Purchase 는 매핑 대상 아님 | 정본 line 2130 주석: `Purchase 는 제외 — Purchase Guard v3 가 단독 관리` |
| NPay 분기에서 funnel-capi 가 InitiateCheckout/AddPaymentInfo eid 박는지 = NPay 결제 흐름에서 외부 도메인 redirect 로 인해 거의 0 | 본 분석 timeline T2 |
| 우리 wrap 의 핵심 가치 = NPay click 자체 추적 + click 시점 deterministic key + checkout-started 단계 보강 | 본 분석 "비어 있는 영역" |

## 진단 우선순위 재조정

1차 진단 결과 + 정본 분석으로 다음과 같이 정리:

| 진단 | 상태 | 새 우선순위 |
|---|---|---|
| 진단 A (페이지 로드 직후 wrappers/cookies/sessionStorage 묶음) | 완료 | 다음 실행 시 `window.__FUNNEL_CAPI_INSTALLED`, `window.FUNNEL_CAPI_CONFIG` 후보 추가 |
| 진단 B (snippet 설치 후 wrap 잡힘 확인) | 완료 (`confirmOrderLooksWrapped: true`) | 그대로 |
| 진단 C (NPay click 후 buffer 변화) | 완료 (변화 0건) | 진단 F 로 원인 분리 |
| 진단 D (페이지 컨텍스트 변경 확인) | 완료 (NPay 외부 redirect 정황) | 그대로 |
| 진단 E (MIRROR_EVENTS 추출, sessionId 추적) | **거의 폐기** | 정본 분석으로 모든 답 확정. 1줄로 축소 (sessionId/sent eid/window 노출 변수 한 번 읽기) |
| 진단 F (직접 호출 sanity test) | 미실행 | **HIGH** — wrap 정상/thin wrapper 우회 분리 |
| 진단 G (NPay click 직후 console marker) | 미실행 | **MID** — 본 분석으로 NPay 외부 redirect 시 funnel-capi 가 추가 marker 출력 안 할 것으로 예상. 단 click 시점 imweb 자체 fbq 호출 (예: AddToCart) 발화 여부는 직접 관찰만이 답 |
| 신규: NPay url 에 query param 부착 후 결제 redirect URL 보존 검증 | 미실행 | **별도 phase, sandbox 결제 필요** — 본 분석에서 결제 완료 페이지 URL search params 에 `order_code`/`order_no`/`payment_key` 가 들어옴이 확인. intent_uuid 도 보존되는지 sandbox 결제 1건으로 확정 |

## 외부 시스템 영향

- imweb 사이트: 본 분석 작성으로 site live 동작 변경 0건 (read-only 정본 분석)
- GTM workspace: 변경 없음
- funnel-capi 코드: 수정 0건 (재사용/공존 정책)
- GA4 / Meta / TikTok / Google Ads: 신규 송출 0건
- 로컬 DB: 신규 테이블 없음
- 외부 API: 신규 호출 없음

## 변경되는 동작

본 분석 작성으로 인해 production 동작은 0건 변경된다. design 문서, snapshot, harness 의 보강만 발생.

## 관련 문서

- [[coffee/!imwebcoffee_code_latest_0501|imweb 헤더/푸터 코드 정본]]
- [[coffee-live-tracking-inventory-20260501]] § 4/5/7/8/10
- [[coffee-npay-intent-beacon-preview-design-20260501]] § v0.4 design 결정
- [[harness/coffee-data/LIVE_TAG_INVENTORY|Coffee Live Tag Inventory template]]
- [[harness/coffee-data/AUDITOR_CHECKLIST|Coffee Auditor Checklist]]
- [[!coffeedata#Phase3-Sprint6|!coffeedata § Phase3-Sprint6]]
