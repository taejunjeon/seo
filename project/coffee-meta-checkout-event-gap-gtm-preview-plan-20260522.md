# 더클린커피 결제 단계 Meta 이벤트 공백과 GTM Preview 설계안

작성 시각: 2026-05-22 00:43 KST
기준일: 2026-05-22
문서 성격: 더클린커피 결제 페이지 Meta 이벤트 공백 진단 및 no-send GTM Preview 설계안
Lane: Green design / Yellow needed for GTM Preview execution / Red needed for Production publish

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/coffee-data/RULES.md
  required_context_docs:
    - project/coffee-imweb-live-smoke-result-20260522.md
    - project/coffee-imweb-full-paste-candidate-20260522.md
    - imweb/code_backup_coffee0522.md
  lane: Green
  allowed_actions:
    - read_only_diagnosis
    - no_send_preview_design
    - approval_packet_draft
  forbidden_actions:
    - GTM Production publish
    - Meta browser event production send
    - Meta CAPI enable
    - actual checkout or purchase
    - Imweb code save
    - production DB or VM Cloud SQLite write
  source_window_freshness_confidence:
    source: TJ님 Pixel Helper observation + Codex no-send checkout reproduction
    window: 2026-05-22 00:39-00:43 KST
    freshness: immediately after Coffee Imweb full code replacement
    confidence: 0.86
```

## 10초 요약

Google 클릭 ID 저장은 실제 Chrome에서도 성공했다. 남은 문제는 결제 페이지에서 Meta `InitiateCheckout` 또는 `AddPaymentInfo`가 자동으로 뜨지 않는 것이다.

현재 Phase 9 코드는 Meta 이벤트를 새로 만들지 않는다. Imweb/aimweb이 이미 쏜 이벤트에 eventID를 붙이는 구조다. 따라서 결제 페이지에서 원래 이벤트가 없으면 Pixel Helper에도 보이지 않는다.

다음 단계는 GTM Preview에서 먼저 no-send 후보를 설계하는 것이다. Production publish와 실제 Meta 전송은 별도 승인 전에는 하지 않는다.

## 관측 결과

1. 상품 상세 페이지
   - Pixel Helper에서 `ViewContent`가 보인다.
   - Phase 9 wrapper가 설치되어 있어 eventID 주입 대상이다.
   - TJ님 실제 Chrome 확인 eventID: `ViewContent.75.mpfnp27y1z4ud1`

2. 결제 페이지
   - Pixel Helper에서 결제 단계 이벤트가 보이지 않는다.
   - Codex no-send 재현에서도 Meta `fbq('track', ...)` 호출은 `PageView`만 관측됐다.
   - 다만 자체 `checkout_started` payload는 만들어진다. 이것은 Meta Pixel Helper에 보이는 이벤트가 아니라 `att.ainativeos.net` attribution endpoint로 보내는 자체 신호다.

### 2026-05-24 추가 관측

상세 결과: [[coffee-organic-vbank-baseline-smoke-20260524]]

TJ님이 Google 검색 결과의 자연 검색 후보 URL로 더클린커피에 진입한 뒤 가상계좌 미입금 주문을 생성했다. VM Cloud read-only 기준 `checkout_started`와 `payment_success(pending)`는 들어왔다. 하지만 브라우저 저장소에 이전 `coffee_smoke_0522` Google CPC 테스트값이 남아 있어 깨끗한 오가닉 baseline으로는 사용할 수 없다.

Meta Pixel Helper에서는 `/shop_payment/` 결제 진입 단계에서 여전히 `InitiateCheckout` 또는 `AddPaymentInfo`가 보이지 않았다. 주문 완료 후에는 `PurchaseDecisionUnknown` custom event가 보였다. 따라서 Coffee 결제 진입 Meta browser event gap은 계속 수정 필요 항목으로 유지한다.

## 바이오컴과의 차이

바이오컴 결제 단계 이벤트는 GTM이 주체라고 보기 어렵다.

현재 바이오컴 정본 문서와 코드 기준으로는 아임웹/FBE browser pixel이 이미 쏘는 `fbq('track', ...)` 호출이 주체다. footer Phase 9는 그 호출을 가로채 eventID를 주입하고, server CAPI mirror 후보를 준비한다.

근거:

- `imweb/!code_headerfooter_biocom.md`의 Phase 9 주석은 dataLayer 구독과 자체 `fbq` 발사 방식을 폐기하고, aimweb이 이미 쏘는 `fbq` 호출을 가로채는 방식으로 전환했다고 적고 있다.
- 같은 주석은 `ViewContent`, `AddToCart`, `InitiateCheckout`, `AddPaymentInfo`를 aimweb plimweb agent가 이미 발사 중이라고 기록한다.
- `imweb/!coderule.md`는 Phase 9가 기존 `fbq('track', ...)` 호출을 감싸는 wrapper라고 정의한다.
- 바이오컴 Block 4는 `fbq` wrapper chain이 실제 `facebook.com/tr` 요청을 만들지 못할 때만 쓰는 Meta browser image-beacon fallback이다. 이것도 GTM이 아니라 footer 보강 경로다.

따라서 Coffee에서 결제 페이지 이벤트가 안 보이는 현재 상태는 "GTM 설정이 빠졌다" 하나로 단정하면 안 된다. Coffee에는 Biocom처럼 결제 단계 Meta browser 이벤트를 실제로 만들거나 fallback하는 Block4가 없다. Coffee Phase 9는 이미 존재하는 `fbq` 이벤트에 eventID를 붙이는 역할이므로, `/shop_payment/`에서 원래 `InitiateCheckout` 또는 `AddPaymentInfo`가 없으면 새 이벤트가 나타나지 않는다.

## 설계 방향

### 기존 GTM 태그 수정 필요 여부

2026-05-24 13:18 KST GTM API read-only 재조회 기준, 더클린커피 `GTM-5M33GC4` live version은 21이고 tags 33 / triggers 24 / variables 13이다. Default Workspace는 workspaceChange 0 / mergeConflict 0이다.

기존 live GTM에서 확인된 결제 시작 관련 체인은 아래 2개다.

1. tag 51 `AGENTSOS - [begin_checkout] 주문서작성`: 주문서 DOM에서 `begin_checkout` dataLayer event를 만드는 Custom HTML.
2. tag 35 `AGENTSOS - [GA4 이벤트전송] begin_checkout`: 위 custom event를 GA4 `begin_checkout`으로 전송.

Meta/Facebook/fbq 전용 GTM 태그는 0건이고, `add_payment_info` 태그도 0건이다.

따라서 결론은 **기존 태그 수정 없음**이다. tag 35/51은 GA4 `begin_checkout` 정본 체인이므로 유지한다. Meta `InitiateCheckout` no-send Preview는 기존 `begin_checkout` custom event나 GA4 전송 태그를 수정하지 않고, 별도 Custom HTML no-send 태그로 분리한다.

1. 먼저 no-send Preview tag를 만든다.
   - 목적: 어떤 조건이면 결제 단계 이벤트를 만들 수 있는지 확인한다.
   - 동작: Meta로 보내지 않고 `console.info` 또는 `dataLayer` debug event만 남긴다.
   - 후보 조건: URL path가 `/shop_payment/`이고 `order_code` 또는 `order_no`가 존재하며, `/shop_payment_complete`가 아니다.
   - dedupe key: `coffee_meta_checkout_preview::{order_code || order_no || location.pathname}`

   현재 로컬 후보:

   - snippet: `scripts/coffee-meta-middle-funnel-browser-fallback-nosend-snippet.js`
   - fixture: `scripts/coffee-meta-middle-funnel-browser-fallback-fixture.mjs`
   - dataLayer event: `coffee_meta_middle_funnel_preview`
   - preview target event name: `InitiateCheckout`
   - 2026-05-24 재검증: `node --check` 2건 PASS, fixture 5/5 PASS

2. 그다음 Preview에서 실제 event payload 모양만 확인한다.
   - 이벤트 후보 A: `InitiateCheckout`
   - 이벤트 후보 B: `AddPaymentInfo`
   - 보수적 판단: `/shop_payment/` 진입만으로는 `InitiateCheckout`이 더 자연스럽다. `AddPaymentInfo`는 결제수단 선택 또는 결제 버튼 직전 조건을 추가로 잡을 수 있을 때 더 정확하다.

3. 운영 반영은 별도 Red 승인으로 분리한다.
   - Meta browser event production send는 외부 플랫폼 전환값에 영향을 준다.
   - GTM Production publish도 사이트 전체 추적에 영향을 준다.

## Preview 성공 기준

- fresh GTM workspace에서만 실행한다.
- Default Workspace는 쓰지 않는다.
- Production publish는 하지 않는다.
- `/shop_payment/`에서 Preview debug event가 1회만 생긴다.
- `/shop_payment_complete` 또는 일반 상품 페이지에서는 생기지 않는다.
- `order_code`, `order_no`, `gclid`, `gbraid`, `gad_campaignid`, `checkoutId` 중 저장 가능한 값이 payload preview에 들어간다.

## 2026-05-24 Preview 생성 결과

상세 결과: [[coffee-meta-initiatecheckout-gtm-preview-create-result-20260524]]

- workspace: `codex_coffee_meta_initiatecheckout_nosend_preview_20260524T042930Z` / id `30`
- trigger: `codex_coffee_shop_payment_domready_nosend_20260524T042930Z` / id `95`
- tag: `codex_coffee_meta_initiatecheckout_nosend_preview_20260524T042930Z` / id `96`
- quick_preview compiler error: `false`
- live version unchanged: `21`
- workspaceChange / mergeConflict: `2 / 0`
- 실제 Meta browser event 전송, Meta CAPI, GA4/Google Ads 전송, GTM Submit/Create version/Production publish는 하지 않았다.

다음은 TJ님 실제 주문서 세션에서 Preview 연결 후 `coffee_meta_middle_funnel_preview`가 1회만 생기는지 확인하는 단계다.

### 2026-05-24 subscription flow 예외 관측

TJ님이 Preview 연결 상태에서 `/subscription/?idx=74&__seo_attribution_debug=1` 흐름을 확인했고, Meta Pixel Helper에 실제 `InitiateCheckout`이 보였다. value는 `21900.00`, currency는 `KRW`, eventID는 order-code-like 값이 포함된 형식이었다.

이 이벤트는 no-send tag 96의 결과로 보지 않는다. tag 96은 `/shop_payment/` + order hint 조건에서만 실행되고, `coffee_meta_middle_funnel_preview` dataLayer event만 만들며, 실제 `fbq` 또는 `facebook.com/tr` 호출을 하지 않는다.

따라서 현재 판단은 아래처럼 수정한다.

- 정기구독 상품 흐름: 기존 Imweb/FBE 또는 footer wrapper 계열이 Meta browser `InitiateCheckout`을 만들 수 있음.
- 일반 주문서 `/shop_payment/`: TJ님 관측 기준 여전히 `InitiateCheckout`/`AddPaymentInfo` 공백이므로 no-send Preview 대상.
- 다음 검증: subscription 페이지가 아니라 실제 `/shop_payment/?order_code=...&order_no=...`에서 tag 96의 `coffee_meta_middle_funnel_preview` 발생 여부를 확인한다.

### 2026-05-24 주문서 화면 no-send Preview PASS

TJ님이 실제 `/shop_payment/` 주문서 화면에서 tag 96이 1회 Fired됨을 확인했다. timing은 `DOM 사용 가능`이고, console payload는 `coffee_meta_middle_funnel_preview`, `eventName=InitiateCheckout`, `noSend=true`, `noFbq=true`, `noPixelRequest=true`, `value=21900`, `currency=KRW`, `value_selector=#oms-shop-payment text:총 주문금액`이었다.

따라서 GTM Preview tag/trigger/payload 조건은 PASS다. 남은 확인은 같은 주문서 화면의 Pixel Helper 또는 Network에서 운영 `InitiateCheckout`이 새로 발생하지 않았는지 보는 것이다.

### 2026-05-24 no-send 최종 판정

TJ님이 같은 Preview 세션에서 Pixel Helper를 확인했고, `/shop_payment/` 주문서 화면의 추가 운영 `InitiateCheckout`은 없었다. Pixel Helper에 남은 `InitiateCheckout` 1건은 `/subscription/?idx=74...` 기준 이벤트였다.

따라서 no-send Preview는 최종 PASS다.

- 주문서 화면: tag 96이 `coffee_meta_middle_funnel_preview`만 1회 생성.
- Meta browser send: 추가 운영 `InitiateCheckout` 0건.
- subscription 화면: 기존 Imweb/FBE 또는 footer wrapper 계열 `InitiateCheckout` 1건 존재.
- 다음 판단: 일반 주문서 Meta `InitiateCheckout` 운영 보강은 가능하지만, subscription 흐름 중복 방지 조건을 반드시 포함해야 한다.

## 다음 액션

1. GTM Preview workspace id `30`은 cleanup 완료했다.
   - result: `data/project/coffee-meta-initiatecheckout-gtm-preview-workspace30-cleanup-20260524T072654Z.json`
   - live version unchanged: `21`
   - Submit/Create version/Production publish: `0건`
2. 실제 Meta browser event 운영 전송 승인안은 작성했고, TJ님 승인 후 운영 반영까지 완료했다.
   - approval doc: [[coffee-meta-initiatecheckout-production-approval-20260524]]
   - publish result: `data/project/coffee-meta-initiatecheckout-gtm-production-publish-20260524T073809Z.json`
3. 남은 일은 실제 주문서 브라우저 smoke다.
   - `/shop_payment/`: Meta Pixel Helper에 `InitiateCheckout` 1회가 보여야 한다.
   - `/subscription/`: 기존 native `InitiateCheckout` 외 추가 중복이 없어야 한다.
   - `/shop_payment_complete`: 이 태그가 발화하면 안 된다.

### 2026-05-24 운영 반영 완료

TJ님 승인 후 fresh workspace에서 실제 운영 태그를 만들고 Production publish까지 완료했다.

- publish result: `data/project/coffee-meta-initiatecheckout-gtm-production-publish-20260524T073809Z.json`
- subscription guard publish result: `data/project/coffee-meta-initiatecheckout-gtm-production-publish-20260524T074633Z.json`
- final post-publish read-only result: `data/project/coffee-meta-initiatecheckout-gtm-production-postpublish-readonly-20260524T074650Z.json`
- live version: `21` -> `23`
- tag: id `99` / `AGENTSOS - [Meta Browser] InitiateCheckout - shop_payment`
- trigger: id `98` / `AGENTSOS - [DOM Ready] shop_payment order only`
- live target tag count: `1`
- live target trigger count: `1`
- workspace id `31`과 `32`는 publish 후 남아 있지 않고, Default Workspace만 남았다.
- 최종 tag에는 `subscription_checkout_excluded` guard가 포함된다.

다음은 실제 주문서 브라우저에서 Pixel Helper smoke를 보는 단계다.
