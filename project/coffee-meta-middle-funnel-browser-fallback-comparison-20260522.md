# 더클린커피 Meta 중간 이벤트 공백 원인 분석과 Biocom식 Browser Fallback 비교

작성 시각: 2026-05-22 01:18 KST
기준일: 2026-05-22
문서 성격: 더클린커피 결제 단계 Meta 중간 이벤트 미발화 원인 분석 및 구현 방향 비교
Lane: Green read-only diagnosis / Green design / Red required before Imweb save or platform send

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
    - project/coffee-meta-checkout-event-gap-gtm-preview-plan-20260522.md
    - project/coffee-imweb-full-paste-candidate-20260522.md
    - imweb/!coderule-thecleancoffee.md
    - imweb/!coderule.md
    - imweb/!code_headerfooter_biocom.md
    - project/ga4-vm-join-key-and-coffee-gap-20260517.md
  lane: Green
  allowed_actions:
    - read_only_live_html_check
    - no_send_network_capture
    - browser_fallback_design
    - approval_boundary_definition
  forbidden_actions:
    - Imweb save/publish
    - GTM Production publish
    - Meta browser event production send
    - Meta CAPI enable
    - GA4/Google Ads/Naver production send
    - actual checkout or purchase
    - production DB or VM Cloud SQLite write
  source_window_freshness_confidence:
    source: thecleancoffee.com live no-send capture + local Imweb code docs + prior GA4/VM Cloud gap docs
    window: 2026-05-22 00:39-01:18 KST
    freshness: immediately after Coffee Imweb full replacement and TJ Pixel Helper confirmation
    confidence: 0.90
```

## 10초 요약

더클린커피 상품상세 `ViewContent`는 정상이다. TJ님 실제 Chrome에서 `ViewContent.75.mpfnp27y1z4ud1` eventID가 확인됐고, Codex no-send capture에서도 Phase9가 `ViewContent`에 eventID를 주입했다.

문제는 결제 페이지다. `/shop_payment/`에서 Meta Pixel 경로 자체는 살아 있지만 `InitiateCheckout` 또는 `AddPaymentInfo`가 원래 발화되지 않는다. VM Cloud, Purchase Guard, Phase9 wrapper, `enableServerCapi=false`가 막는 구조가 아니다.

따라서 다음 구현은 GTM-first보다 Coffee 전용 browser fallback 설계가 더 직접적이다. 단, 실제 browser event 전송과 Imweb 저장은 Red Lane이라 no-send preview와 승인안부터 진행해야 한다.

## 관측 결과

### 상품상세

- TJ님 Pixel Helper 확인: `ViewContent.75.mpfnp27y1z4ud1`
- Codex live no-send capture:
  - `window.__FUNNEL_CAPI_INSTALLED`: `2026-04-15-thecleancoffee-funnel-capi-v3`
  - `FUNNEL_CAPI_CONFIG.enableServerCapi`: `false`
  - `fbq` agent: `imweb`
  - console: `inject eid ViewContent ViewContent.75...`
  - console: `server skipped (disabled) ViewContent ...`

해석: `enableServerCapi=false`여도 browser `ViewContent`는 발화되고 eventID 주입도 된다. 즉 CAPI false는 browser Pixel 이벤트를 막지 않는다.

### 결제 페이지

Codex live no-send capture는 실제 외부 전송 URL을 차단하고 발화 시도만 보았다.

- URL scope: `/shop_payment/`
- `window.__FUNNEL_CAPI_INSTALLED`: `2026-04-15-thecleancoffee-funnel-capi-v3`
- `FUNNEL_CAPI_CONFIG.enableServerCapi`: `false`
- `fbq` agent: `imweb`
- `checkout_started` 자체 context: 생성됨
- Meta Pixel 발화 시도: `PageView`만 관측
- `InitiateCheckout`: 0
- `AddPaymentInfo`: 0
- VM Cloud attribution endpoint: 차단했지만, 이것은 자체 `checkout_started` 수신점이다. Meta browser event 생성과 별개다.

해석: 결제 페이지에서 Meta Pixel이 완전히 죽은 것이 아니다. PageView는 시도된다. 다만 결제 단계 이벤트 원천이 없다.

## 원인 분류

### CAPI false 때문인가

아니다.

`enableServerCapi=false`는 Phase9가 VM Cloud의 `/api/meta/capi/track`으로 서버 전송하지 않게 하는 설정이다. 같은 상태에서 상품상세 `ViewContent` browser event는 정상 관측됐다. 따라서 CAPI false는 server mirror만 끄고, browser `facebook.com/tr` 발화 자체를 막지 않는다.

### VM Cloud가 가로채거나 막는가

아니다.

VM Cloud는 `checkout-context`, `payment-success`, `meta/capi/track` 같은 서버 수신점이다. 브라우저 Meta Pixel 요청은 사용자의 브라우저에서 Meta의 `facebook.com/tr`로 직접 나간다. VM Cloud는 그 요청 경로 중간에 없다.

이번 no-send capture에서 VM Cloud endpoint를 차단해도 `fbq` wrapper와 Meta PageView 시도는 살아 있었다. 이것도 VM Cloud가 browser Meta 이벤트를 막는 구조가 아니라는 근거다.

### Purchase Guard가 막는가

아니다.

Coffee Purchase Guard는 `Purchase`만 결제 판단 후 allow/block한다. middle-funnel event인 `ViewContent`, `AddToCart`, `InitiateCheckout`, `AddPaymentInfo`를 차단하는 로직이 아니다.

실제로 상품상세 `ViewContent`는 Purchase Guard 설치 상태에서도 정상 eventID가 붙었다.

### Phase9 wrapper가 막는가

아니다.

Phase9는 `fbq('track', ...)` 호출이 들어왔을 때 eventID를 보강한 뒤 원래 `fbq`로 넘긴다. 코드상 `return orig.apply(this, args)` 경로가 있다.

상품상세에서 `ViewContent`가 정상 통과했으므로 wrapper가 middle event를 전반적으로 막는 상태는 아니다.

### Imweb/FBE가 결제 단계 이벤트를 안 쏘는가

현재 가장 유력하다.

Coffee 결제 페이지에서 `fbq` agent는 `imweb`으로 살아 있고 PageView는 보인다. 그런데 `InitiateCheckout/AddPaymentInfo` 원 이벤트가 없다. 즉 Coffee의 Imweb/FBE 설정 또는 결제 페이지 조건에서 해당 middle event를 만들지 않는 상태로 보는 것이 맞다.

이 판단은 과거 GA4 gap과도 맞는다. `project/ga4-vm-join-key-and-coffee-gap-20260517.md`에서 2026-05-10~2026-05-16 더클린커피는 purchase 432건이 있지만 `begin_checkout=0`, `add_payment_info=0`이었다. 결제가 없는 것이 아니라 중간 이벤트 계측 gap이다.

## Biocom과 Coffee 차이

### Biocom

바이오컴은 Meta browser/FBE 이벤트가 이미 살아 있는 구조다.

- `imweb/!code_headerfooter_biocom.md`의 Phase9 주석은 aimweb이 이미 `ViewContent`, `AddToCart`, `InitiateCheckout`, `AddPaymentInfo`를 발사 중이라고 기록한다.
- Phase9는 자체 이벤트 생성기를 폐기하고, aimweb의 `fbq('track', ...)` 호출을 가로채 eventID를 주입하는 구조다.
- `gdn/biocom-fbe-browser-server-event-health-20260514.md` 기준으로 2026-05-14 당일 `InitiateCheckout` 45건이 Meta browser/FBE stats에 있었다.
- 같은 문서 기준 최근 7일 `AddPaymentInfo` 182건도 있었다.
- `enableServerCapi=false`라 Purchase 외 중간 이벤트 server mirror는 꺼져 있었다.

즉 Biocom 중간 이벤트는 GTM이 주체라기보다 아임웹/FBE browser Pixel이 주체다. footer는 eventID 보강과 fallback 역할이다.

주의할 점도 있다. `imweb/!coderule.md`에는 Biocom Block4 browser image-beacon fallback 기준이 정의돼 있지만, 현재 로컬 `imweb/!code_headerfooter_biocom.md` 스냅샷에서는 `biocom_block4` 문자열은 직접 잡히지 않는다. 그래서 Coffee에 코드를 그대로 복사하면 안 된다. 원칙과 구조를 Coffee용으로 재설계해야 한다.

### Coffee

더클린커피는 상품상세 `ViewContent`는 살아 있다. 하지만 결제 페이지에서 Imweb/FBE가 `InitiateCheckout/AddPaymentInfo`를 만들지 않는다.

현재 Coffee footer Phase9는 Biocom과 같은 wrapper 구조지만, "이미 존재하는 event"에만 eventID를 붙인다. 없는 `InitiateCheckout/AddPaymentInfo`를 새로 만들지는 않는다.

따라서 Coffee에는 두 선택지가 있다.

1. GTM Preview에서 새 event 후보를 만든다.
2. Biocom식 browser fallback 원칙을 Coffee footer에 맞게 설계한다.

## 구현 방향 비교

### 옵션 A. GTM Preview 우선

장점:

- Imweb footer를 다시 저장하지 않고 fresh GTM workspace에서 Preview 검증 가능.
- Preview와 rollback 절차가 명확하다.
- `dataLayer`/DOM 조건을 보며 실험하기 쉽다.

단점:

- Production publish는 Red Lane이다.
- Coffee의 기존 Meta Phase9 wrapper와 최종 browser event 흐름을 맞추려면 결국 `fbq` 호출 또는 Custom HTML이 필요하다.
- GTM이 원래 원천이 아닌 이벤트를 만들게 되므로, Biocom의 현재 Meta browser/FBE 구조와는 다르다.

판정: 안전한 실험에는 좋지만, 최종 운영 구조의 주체로 확정하기 전에는 한 단계 더 비교가 필요하다.

### 옵션 B. Coffee 전용 browser fallback

장점:

- Biocom의 실제 운영 철학과 더 가깝다. Meta browser event는 브라우저에서 만들고, Phase9 wrapper가 eventID를 보강한다.
- `enableServerCapi=false` 상태에서도 browser event만 만들 수 있다.
- `/shop_payment/`의 자체 `checkout_started` context, Google click id context, `checkoutId`를 함께 사용할 수 있다.

단점:

- Imweb footer 저장은 Red Lane이다.
- 실제 `fbq('track', 'InitiateCheckout', ...)` 호출 또는 `facebook.com/tr` fallback은 Meta browser event를 새로 만드는 작업이다. 운영 카운트에 영향을 주므로 승인 전 실행 금지다.
- 금액 DOM을 안정적으로 읽지 못하면 `value` 누락 위험이 있다.

판정: 최종 방향으로는 더 적합하다. 단, 구현은 no-send preview -> 제한 smoke 승인 -> 운영 반영 승인 순서가 필요하다.

### 옵션 C. VM Cloud server CAPI로 중간 이벤트 생성

장점:

- 서버에서 dedupe와 로그를 통제하기 쉽다.
- Test Events smoke를 분리하기 쉽다.

단점:

- 지금 문제는 Pixel Helper에 보이는 browser event 공백이다. server CAPI만 켜도 browser Pixel Helper의 결제 단계 이벤트 공백은 직접 해결되지 않는다.
- `enableServerCapi=true`는 외부 플랫폼 서버 전송이라 Red Lane이다.

판정: 지금 1순위가 아니다. browser fallback이 먼저다.

## 권장 설계

1순위는 Coffee 전용 browser fallback no-send preview다.

운영 이벤트 이름은 먼저 `InitiateCheckout`으로 좁힌다. `/shop_payment/` 진입은 결제 시작으로 해석하기 쉽지만, `AddPaymentInfo`는 결제수단 선택 또는 결제 버튼 직전 신호가 확인될 때만 쓰는 것이 맞다.

초기 no-send preview 조건:

- path includes `/shop_payment/`
- path does not include `/shop_payment_complete` or `/shop_order_done`
- `order_code` 또는 `order_no` 또는 `checkoutId` 중 하나 존재
- sessionStorage dedupe key로 1회만 preview
- `__thecleancoffee_click_id_context_v1`에서 Google click id 묶음 읽기
- `__seo_checkout_context`에서 checkoutId, clientId, gaSessionId 읽기
- 실제 `fbq` 호출 금지
- 실제 `facebook.com/tr` image beacon 금지
- console/dataLayer debug event만 남김

preview payload 필수 항목:

- eventName: `InitiateCheckout`
- eventID: `InitiateCheckout.{checkoutId 또는 session-scoped id}`
- currency: `KRW`
- value: DOM에서 읽히면 포함, 불안정하면 `value_missing`으로 preview만 기록
- order hint: raw 값 출력 금지, presence/hash/length만 기록
- gclid/gbraid/wbraid/gad_campaignid: raw 출력 금지, presence와 source만 기록

`AddPaymentInfo`는 별도 2단계다.

- 결제수단 선택 DOM 또는 클릭 이벤트를 안정적으로 잡을 수 있을 때만 후보로 올린다.
- 단순 `/shop_payment/` 진입만으로 `AddPaymentInfo`를 보내면 의미가 과장될 수 있다.

## Green fixture 결과

로컬 fixture를 추가해 Coffee browser fallback no-send preview의 최소 조건을 검증했다.

- 스크립트: `scripts/coffee-meta-middle-funnel-browser-fallback-fixture.mjs`
- 실행: `node --check scripts/coffee-meta-middle-funnel-browser-fallback-fixture.mjs && node scripts/coffee-meta-middle-funnel-browser-fallback-fixture.mjs`
- 결과: 5/5 PASS

검증한 것:

- `/shop_payment/` + order hint가 있으면 `InitiateCheckout` preview 후보가 생긴다.
- 상품상세 페이지는 차단된다.
- 결제완료 페이지는 차단된다.
- order hint 없는 checkout URL은 차단된다.
- 금액을 못 읽으면 `value=0`으로 속이지 않고 `value_status=missing`으로 남긴다.
- raw order code, raw member code, raw click id는 preview result에 출력하지 않는다.

## 승인 경계

Green:

- 문서 설계
- 로컬 no-send snippet fixture
- live read-only HTML 확인
- Playwright에서 외부 전송 URL 차단 후 발화 시도 관찰
- preview payload 생성

Yellow:

- GTM Preview workspace에서 no-send debug tag 검증
- 제한된 실제 브라우저 Preview 세션

Red:

- Imweb footer 저장
- GTM Production publish
- Meta browser event 실제 전송
- Meta CAPI enable
- 실제 결제 테스트

## 다음 액션

1. Coffee browser fallback no-send snippet을 로컬 fixture로 만든다.
2. `/shop_payment/` HTML/DOM에서 value/currency 후보 selector를 read-only로 조사한다.
3. no-send preview가 안정적이면 Imweb footer 후보와 GTM Preview 후보를 다시 비교한다.
4. 실제 운영 event 전송 전에는 승인안을 별도 작성한다.
