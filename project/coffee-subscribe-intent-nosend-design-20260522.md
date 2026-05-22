# 더클린커피 구독 Intent No-Send 설계

작성 시각: 2026-05-22 12:49 KST
기준일: 2026-05-22
문서 성격: 더클린커피 정기구독 신청 intent를 실제 전송 없이 분리 관측하기 위한 설계와 로컬 검증 결과
Lane: Green no-send snippet candidate / no-write / no-publish

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
    - project/coffee-imweb-live-smoke-result-20260522.md
    - project/coffee-meta-subscribed-buttonclick-auto-detect-audit-20260522.md
    - data/coffee-live-tracking-inventory-20260501.md
  lane: Green
  allowed_actions:
    - live_html_readonly_inspection
    - no_send_snippet_candidate
    - local_fixture_smoke
    - document_update
  forbidden_actions:
    - Imweb save/publish
    - GTM Production publish
    - Meta browser event production send
    - Meta CAPI enable
    - GA4/Google Ads/Naver production send
    - actual checkout or purchase
    - production DB or VM Cloud SQLite write
  source_window_freshness_confidence:
    source: thecleancoffee.com/subscription/?idx=74 live HTML read-only + TJ님 Chrome Pixel Helper observation + local Playwright fixture
    window: 2026-05-22 11:58-12:49 KST
    freshness: same-day live HTML and same-turn local fixture
    confidence: 0.91
```

## 10초 요약

`SubscribedButtonClick`은 TJ님 승인에 따라 보고서/ROAS/구독 성과 판정에서 제외한다.

대신 정기구독 intent는 `/subscription`의 실제 신청 버튼만 따로 본다. 이 문서의 후보 코드는 실제 Meta 이벤트를 보내지 않고, 내부 preview 이벤트만 `dataLayer`와 전역 변수에 남긴다.

로컬 fixture 9개 케이스는 통과했다. 옵션 드롭다운, 일반 구매, 장바구니, 모바일 옵션 열기 버튼은 제외되고, 실제 정기구독 신청 버튼만 잡힌다.

## 왜 분리하는가

Pixel Helper에서 보이는 `SubscribedButtonClick`은 이름만 보면 구독 신청처럼 보인다. 하지만 실제 관측상 일반 상품 옵션 드롭다운을 눌러도 생기고, 정기구독 상품에서도 옵션 선택마다 생긴다.

따라서 이 이벤트를 성과로 쓰면 `옵션을 고른 사람`과 `정기구독 신청을 누른 사람`이 섞인다.

구독 intent는 버튼 이름보다 실제 버튼 속성을 기준으로 분리해야 한다. Coffee 라이브 HTML에서 실제 신청 버튼은 아래 조건을 동시에 갖는다.

- 페이지 경로: `/subscription` 또는 `/subscription/`
- 정기구독 상품 속성: `data-bs-is-regularly-prod="true"`
- 실제 구매/신청 행동: `data-bs-content="purchase"`
- Imweb 결제 버튼 속성: `data-bs-payment-button-type="imweb_payment"`
- 버튼 class: `im-regularly`
- 버튼 문구: `정기구독 신청` 또는 모바일 최종 버튼의 `정기구독`

## 현재 판정

`SubscribedButtonClick`은 보고서에서 제외한다.

구독 intent는 새 내부 preview 이름으로 분리한다.

```text
event: coffee_subscribe_intent_preview
eventName: SubscribeIntentPreview
```

이 이름은 운영 Meta 이벤트명이 아니다. 실제 `fbq`, Meta CAPI, `facebook.com/tr` 요청을 만들지 않는다.

## 후보 파일

- snippet: `scripts/coffee-subscribe-intent-nosend-snippet.js`
- smoke: `scripts/coffee-subscribe-intent-nosend-smoke.mjs`

## 동작 조건

실제 preview가 남는 조건은 모두 충족해야 한다.

1. 현재 URL path가 `/subscription` 계열이다.
2. 클릭 대상이 `a`, `button`, `[role="button"]` 중 하나다.
3. 버튼에 `data-bs-is-regularly-prod="true"`가 있다.
4. 버튼에 `data-bs-content="purchase"`가 있다.
5. 버튼에 `data-bs-payment-button-type="imweb_payment"`가 있다.
6. 버튼 class에 `im-regularly`가 있다.
7. 버튼 문구가 `정기구독 신청` 또는 `정기구독`이다.
8. 같은 버튼 rapid double click은 1.5초 안에서 1건만 남긴다.

제외 조건은 아래다.

- `중량 (필수)`, `분쇄도 (필수)` 같은 옵션 드롭다운
- 일반 상품 `구매하기`
- 정기구독 상품의 `장바구니`
- 모바일에서 옵션 패널만 여는 `정기구독` 버튼
- `/thecleancoffee/?idx=*` 같은 일반 상품 페이지

## Preview payload 정책

raw order code, order no, member code, click id, phone, email은 넣지 않는다.

상품 코드는 원문을 넣지 않고 hash와 present 여부만 남긴다.

```js
{
  event: 'coffee_subscribe_intent_preview',
  eventName: 'SubscribeIntentPreview',
  eventID: 'SubscribeIntentPreview.{hash}',
  noSend: true,
  noFbq: true,
  noPixelRequest: true,
  noNetwork: true,
  customData: {
    intent_type: 'subscription_application',
    currency: 'KRW',
    value: 18900,
    value_status: 'present',
    value_selector: 'main text:총 상품금액',
    product_idx: '74',
    product_code_present: true,
    product_code_hash: '{hash}',
    product_type: 'normal',
    where: 'shop_view',
    payment_button_type: 'imweb_payment',
    is_regularly_prod: true,
    button_text_class: 'subscribe_apply',
    subscription_path: true
  }
}
```

금액은 `총 상품금액` 라벨 뒤의 첫 원화 금액을 읽는다. 못 읽으면 `value=null`, `value_status=missing`으로만 남긴다. 실제 전송 단계에서도 value가 없을 때 `0원`으로 보내는 것은 금지한다.

## 실제 전송 금지 확인

후보 snippet은 아래를 호출하지 않는다.

- `fbq(...)`
- `fetch(...)`
- `navigator.sendBeacon(...)`
- `new Image()`
- `facebook.com/tr`
- `att.ainativeos.net`
- GA4/Google Ads/Naver collect URL

남기는 것은 아래뿐이다.

- `window.dataLayer.push(...)`
- `window.__THECLEANCOFFEE_SUBSCRIBE_INTENT_PREVIEW_LAST__`
- `window.__THECLEANCOFFEE_SUBSCRIBE_INTENT_PREVIEW_HISTORY__`
- debug query가 있을 때만 `console.info`

## 검증 결과

실행 명령:

```bash
node --check scripts/coffee-subscribe-intent-nosend-snippet.js
node --check scripts/coffee-subscribe-intent-nosend-smoke.mjs
node scripts/coffee-subscribe-intent-nosend-smoke.mjs
```

결과:

- desktop `정기구독 신청`: PASS
- mobile 최종 `정기구독`: PASS
- 옵션 드롭다운: PASS, preview 0건
- 일반 구매 버튼: PASS, preview 0건
- 정기구독 장바구니 버튼: PASS, preview 0건
- 모바일 옵션 열기 버튼: PASS, preview 0건
- 1.5초 안 중복 클릭: PASS, preview 1건
- 일반 상품 페이지: PASS, preview 0건
- 금액 missing: PASS, preview 생성 + `value_status=missing`
- raw product code / session id leakage: 0
- external request: 0

## 운영 반영 판단

아직 운영 반영하지 않는다.

현재 단계의 목적은 구독 intent 조건을 분리하는 것이다. Imweb footer에 저장하면 운영 사이트 전체 script 변경이 되므로 Red Lane이다.

다음에 실제 반영을 검토한다면 순서는 아래가 맞다.

1. no-send snippet을 Imweb footer 후보에 통합한다.
2. TJ님 실제 Chrome에서 `/subscription/?idx=74`에서 옵션 선택과 신청 버튼 클릭을 분리 검증한다.
3. `coffee_subscribe_intent_preview`가 신청 버튼에서만 1건 남는지 확인한다.
4. 실제 Meta 이벤트로 전환할지, 서버 수신점에만 남길지 별도 승인안으로 결정한다.

실제 Meta 이벤트 전송, Meta CAPI 전송, Imweb 저장/publish, GTM Production publish는 승인 전 금지다.

## 다음 판단

추천은 `SubscribedButtonClick 제외 유지 + SubscribeIntentPreview no-send 후보 보관`이다.

구독 intent를 실제 운영 지표로 쓰려면 `SubscribeIntentPreview`를 먼저 실제 브라우저에서 no-send로 확인해야 한다. 그 다음에만 실제 browser event 또는 서버 수신점 전환 여부를 결정한다.
