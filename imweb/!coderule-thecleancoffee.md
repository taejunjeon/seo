# 더클린커피 Imweb Custom Code Rule

작성 시각: 2026-05-21 23:05 KST
기준일: 2026-05-21
문서 성격: 더클린커피 Imweb 헤더/바디/푸터 코드 운영 규칙 초안
Lane: Green 문서화 / read-only 기준 정리
정본 입력: TJ님 제공 live 코드, `coffee/!imwebcoffee_code_latest_0501.md`, `GA4/gtm-thecleancoffee.md`, `data/!coffeedata.md`, `harness/coffee-data/LIVE_TAG_INVENTORY.md`

```yaml
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
    - imweb/!coderule.md
    - GA4/gtm-thecleancoffee.md
    - data/!coffeedata.md
  lane: Green
  allowed_actions:
    - document
    - read_only_audit
    - no_send_design
    - GTM Preview plan
  forbidden_actions:
    - Imweb save/publish
    - GTM Production publish
    - Google Ads conversion action mutate
    - Google Ads conversion upload
    - GA4/Meta/Google Ads production send toggle
    - production DB write
  source_window_freshness_confidence:
    source: TJ provided Imweb code + local docs + read-only inventory
    window: current live code snapshot as of 2026-05-21
    freshness: live code provided by TJ; repo snapshots may be older
    confidence: 0.86
```

## 10초 요약

더클린커피 코드는 바이오컴 Imweb 규칙을 그대로 복사하면 안 된다. 현재 Coffee는 결제완료 Purchase Guard, checkout/payment-success attribution, Meta middle-funnel mirror, GTM live v21 begin_checkout가 이미 얽혀 있으므로, 전체 교체가 아니라 슬롯별 불변조건을 지키면서 GTM Preview 후보를 하나씩 올리는 방식이 정답이다.

현재 바로 바꿀 대상은 없다. 먼저 Google Ads 장바구니 전환은 read-only로 action/label/primary 여부를 감사하고, add_payment_info는 GTM Preview 후보 설계까지가 Green Lane이다.

## 슬롯별 현재 역할

### 1. 헤더 코드 상단

역할: Meta Purchase가 실제 결제완료 주문인지 서버 decision endpoint로 확인한 뒤, 구매로 보낼지 보류/차단 custom event로 돌릴지 결정한다.

현재 핵심 식별자:

- `snippetVersion`: `2026-04-14-coffee-server-payment-decision-guard-v3`
- `pixelId`: `1186437633687388`
- `decisionEndpoint`: `https://att.ainativeos.net/api/attribution/payment-decision`
- `site/store`: `thecleancoffee`
- blocked/unknown/vbank custom event: `PurchaseBlocked`, `PurchaseDecisionUnknown`, `VirtualAccountIssued`

유지해야 할 불변조건:

- `Purchase`는 서버 decision이 `allow_purchase`일 때만 원 호출을 통과시킨다.
- 가상계좌 발급은 구매완료가 아니며 `VirtualAccountIssued`로 분리한다.
- unknown/blocked branch를 임의로 구매로 fallback하지 않는다.
- Coffee용 site/store/pixel id를 바이오컴 값으로 덮어쓰지 않는다.

개선 후보:

- 바이오컴 최신 guard와 버전 차이가 있으나, Coffee에는 Coffee 결제/Meta/Imweb 상태가 따로 있으므로 단순 이식 금지.
- Google click id 보존은 헤더 상단 guard 자체보다 footer attribution/GTM 쪽에서 먼저 검증한다.

### 2. 헤더 코드

역할: GTM 로더, Google Ads 장바구니 전환, Beusable, Naver wcs를 로드한다.

현재 핵심 식별자:

- GTM container: `GTM-5M33GC4`
- Google Ads cart conversion send_to: `AW-304339096/Xq1KCMTrt4oDEJixj5EB`
- 조건: `window.location.href.endsWith('shop_cart')`
- Naver wcs: `wcs_add["wa"] = "4b725022d61ce0"`

주의:

- Google Ads cart conversion은 구매완료 전환이 아니다. 예산 판단용 구매 ROAS와 섞으면 안 된다.
- `endsWith('shop_cart')` 조건은 query string, trailing slash, Imweb URL 변경에 취약하다.
- Google Ads action이 Primary 전환이면 장바구니가 입찰 학습에 들어갈 수 있으므로, read-only로 action/category/primary/counting 상태를 먼저 확인한다.
- 이 hardcoded snippet을 제거하거나 GTM으로 이전하는 것은 Google Ads/GTM 영향이 있으므로 별도 승인 전에는 금지한다.

2026-05-21 read-only audit 결과:

- source: Google Ads API `conversion_action` read-only search
- 기준 시각: 2026-05-21 23:06 KST
- customer id: `2149990943`
- api version: `v22`
- scanned conversion actions: 68
- exact matched action count: 1
- action id: `827192772`
- action name: `더클린커피 장바구니에 추가`
- status: `REMOVED`
- type/category: `WEBPAGE` / `ADD_TO_CART`
- primary_for_goal: `true`
- counting_type: `MANY_PER_CLICK`
- send_to: `AW-304339096/Xq1KCMTrt4oDEJixj5EB`

해석: 이 전환 액션은 과거 설정상 Primary였지만 현재 `REMOVED` 상태다. 따라서 지금 입찰 학습에 쓰이는 활성 Primary 장바구니 전환으로 보기는 어렵고, live Imweb 코드에는 삭제된 label 호출이 잔존할 가능성이 높다. 삭제/대체는 Imweb 저장이 필요한 Red Lane이므로, 문서와 Preview 설계에서 먼저 분리한다.

### 3. 바디 코드

역할: GTM noscript iframe과 Keepgrow 로그인/회원 스크립트를 유지한다.

유지해야 할 불변조건:

- GTM noscript container id는 `GTM-5M33GC4`와 일치해야 한다.
- Keepgrow script/CSS는 회원/로그인 UX 영향 가능성이 있으므로 attribution 작업 중 임의 수정하지 않는다.

### 4. 푸터 코드

역할: UTM/click id 보존, checkout_started 수집, payment_success 수집, Meta middle-funnel CAPI mirror 준비를 담당한다.

현재 핵심 블록:

- Block 1: `_p1s1a_*` UTM persistence + optional gtag user_id
- Block 2: `checkout-context`, source `thecleancoffee_imweb`, GA4 `G-JLSBXX7300`
- Block 3: `payment-success`, orderCode/orderId/paymentKey/referrerPayment 수집
- Phase 9 Funnel CAPI mirror: `2026-04-15-thecleancoffee-funnel-capi-v3`
- Meta CAPI mirror 설정: `enableServerCapi=false`, `debug=true`

유지해야 할 불변조건:

- `enableServerCapi=true` 전환은 Meta 서버 전송이므로 Red Lane이다.
- Phase 9는 `Purchase`를 제외하고, `ViewContent`, `AddToCart`, `InitiateCheckout`, `AddPaymentInfo`만 mirror 후보로 본다.
- `Purchase`는 헤더 상단 Purchase Guard가 단독 관리한다.
- payment_success는 결제완료 evidence 수집이며, 광고 플랫폼 전송 자체가 아니다.

개선 후보:

- 현재 footer click id persistence는 `gclid/fbclid/ttclid` 중심이다. Google Ads 테스트에서는 `gbraid/wbraid` 보존 여부도 함께 확인한다.
- add_payment_info는 footer에서 새로 만들기보다 GTM Preview 후보로 설계해 기존 GTM live v21 begin_checkout 흐름과 충돌 여부를 먼저 확인한다.

## GTM과 역할 분리

더클린커피 GTM 정본은 `GA4/gtm-thecleancoffee.md`이다. live v21 기준 begin_checkout은 이미 GTM 쪽에서 다루고 있으므로, footer에 begin_checkout을 다시 추가하지 않는다.

GTM Preview 후보로 올릴 수 있는 항목:

1. `add_payment_info`: 결제수단 선택/결제 단계 진입 evidence를 GA4 표준 이벤트로 관측.
2. `view_cart` / `add_to_cart`: hardcoded Google Ads cart 전환과 중복/차이를 비교하기 위한 관측.
3. coupon/download/scroll 계열: Coffee middle-funnel 보강 후보지만, ROAS 정합성 우선순위에서는 뒤로 둔다.

GTM Production publish는 Red Lane이다. Preview, workspace diff, JSON backup, live version unchanged 확인까지만 Green/Yellow 범위로 본다.

## 절대 금지선

- Imweb 저장/배포
- GTM Production publish
- Google Ads conversion action 생성/수정
- Google Ads conversion upload
- Google Ads budget/bidding/campaign 변경
- GA4/Meta/Google Ads production server send toggle
- 운영 DB 또는 VM Cloud SQLite write
- NPay 클릭을 구매완료로 간주하는 이벤트 생성

## 교체 판단

현재 결론: 더클린커피 헤더/푸터 전체 교체는 보류한다.

이유:

- Coffee 코드에는 Coffee 전용 pixel id, GA4 id, payment-decision branch, Naver wcs, Keepgrow, GTM live v21 상태가 있다.
- 바이오컴 최신 코드와 구조가 비슷해 보여도 payment/payment_success/orderCode/eid 계약이 다르다.
- 지금 필요한 것은 전체 교체가 아니라 Google Ads 장바구니 전환 감사, click id 저장 smoke, add_payment_info Preview 설계 순서다.

## 최소 검증 체크리스트

1. Google Ads 장바구니 전환 read-only 감사 - 완료 2026-05-21
   - 대상: `AW-304339096/Xq1KCMTrt4oDEJixj5EB`
   - 확인: conversion action name/category/status/primary_for_goal/counting_type/tag_snippet label
   - 결과: exact match 1건, action `더클린커피 장바구니에 추가`, `REMOVED`, category `ADD_TO_CART`, historical `primary_for_goal=true`.
   - 성공 기준: 장바구니가 구매완료/Primary로 예산 판단에 섞이는지 분리된다.

2. Coffee live click-id 저장 smoke
   - 대상: `gclid`, `gbraid`, `wbraid`, `fbclid`, `ttclid`
   - 확인: URL parameter가 `_p1s1a_last_touch`, checkout-context, payment-success payload로 이어지는지.
   - 2026-05-21 no-send landing/cart smoke 결과: `gclid`는 `_p1s1a_last_touch`와 `sessionStorage._p1s1a_session_touch` 구조화 필드로 `shop_cart`까지 보존된다. `gbraid`, `wbraid`, `gad_campaignid`는 full landing URL 문자열에는 남지만 구조화 필드로는 저장되지 않는다. 상세 결과는 `project/coffee-google-click-storage-smoke-result-20260521.md`.
   - 보강안: `project/coffee-google-click-id-structured-storage-plan-20260521.md`. 바이오컴 v4.4.3의 atomic Google click-id 선택 규칙을 Coffee 전용 key/version으로 이식하되, Imweb 저장은 별도 Red 승인 전 금지한다.
   - 성공 기준: Google Ads 클릭 후 주문/결제 단계 evidence에 click id가 남는지 판단할 수 있다.

3. Meta Pixel Test Events
   - 대상: Phase 9 mirror와 Purchase Guard branch.
   - 확인: browser eventId 주입, server CAPI disabled 상태, Purchase 제외 유지.
   - 2026-05-21 no-send smoke 결과: live page에서 `fbq` wrapper와 `2026-04-15-thecleancoffee-funnel-capi-v3` 설치를 확인했다. synthetic `ViewContent`, `AddToCart`, `InitiateCheckout`, `AddPaymentInfo`는 eventId/value/currency를 가진 `facebook.com/tr` 요청을 만들었고, 요청은 캡처 후 abort했다. Meta CAPI request 0건, Purchase request 0건. 상세 결과는 `project/coffee-meta-pixel-eventid-nosend-smoke-result-20260521.md`.
   - 성공 기준: 테스트 코드 적용 전에도 브라우저 eventId와 no-server-send 상태가 분리된다.

4. add_payment_info GTM Preview 설계
   - 대상: 결제수단 선택/결제 페이지 dataLayer 또는 DOM signal.
   - 확인: begin_checkout과 중복되지 않고, Purchase/payment_success와 섞이지 않는 트리거.
   - 성공 기준: Preview에서만 이벤트 후보가 firing되고 live/publish는 하지 않는다.

## 권장 우선순위

1순위는 Meta Pixel Test Events와 Google Ads 클릭 저장 smoke다. 이유는 지금 설치된 코드가 실제 브라우저에서 어떤 eventId/click id를 남기는지 확인해야 add_payment_info Preview 트리거의 입력 신호를 정확히 고를 수 있기 때문이다.

2순위는 add_payment_info GTM Preview 설계다. 설계 자체는 Green Lane으로 진행 가능하지만, 실제 Preview 확인 전에 브라우저 저장/픽셀 상태가 확인되지 않으면 트리거 기준이 추정에 머문다.
