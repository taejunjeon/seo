# 더클린커피 구독 Intent GTM 처리 가능성 검토

작성 시각: 2026-05-22 12:59 KST
기준일: 2026-05-22
문서 성격: 더클린커피 정기구독 intent를 GTM Preview/운영 태그로 처리할 수 있는지 검토한 의사결정 메모
Lane: Green design review / Yellow needed for GTM Preview execution / Red needed for GTM Production publish or Imweb save

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/coffee-data/README.md
    - harness/coffee-data/RULES.md
  required_context_docs:
    - project/coffee-subscribe-intent-nosend-design-20260522.md
    - project/coffee-meta-subscribed-buttonclick-auto-detect-audit-20260522.md
    - project/coffee-imweb-full-paste-candidate-20260522.md
    - GA4/gtm-thecleancoffee.md
    - imweb/!coderule-thecleancoffee.md
  lane: Green
  allowed_actions:
    - read_only_live_html_inspection
    - GTM design review
    - no_send_preview_plan
    - documentation
  forbidden_actions:
    - GTM workspace create/update without separate approval
    - GTM Production publish
    - Imweb save/publish
    - Meta browser event production send
    - Meta CAPI enable
    - GA4/Google Ads/Naver production send
    - production DB or VM Cloud SQLite write
  source_window_freshness_confidence:
    source: thecleancoffee.com/subscription/?idx=74 live HTML read-only + local GTM inventory + no-send fixture result
    window: 2026-05-22 12:49-12:59 KST
    freshness: same-day live HTML and same-turn local review
    confidence: 0.89
```

## 10초 요약

구독 intent는 GTM으로 처리할 수 있다.

다만 “GTM Preview로 no-send 검증”과 “GTM Production publish로 운영 반영”은 다르다. Preview는 별도 Yellow 승인 후 fresh workspace에서 해볼 수 있고, Production publish는 사이트 전체 추적 변경이므로 Red Lane이다.

추천은 `full paste 후보에 바로 통합`보다 `GTM Preview no-send 후보를 먼저 설계/검증`이다. 이유는 Imweb 전체 footer를 다시 저장하지 않고도 실제 버튼 조건과 오탐 여부를 확인할 수 있기 때문이다.

## 결론

현재 질문의 답은 아래다.

1. **GTM으로 처리 가능하다.**
2. **운영 반영 전 검증은 GTM Preview가 더 낫다.**
3. **항상 켜지는 운영 수집으로 만들 때는 GTM publish든 Imweb 저장이든 승인선은 Red다.**
4. **실제 Meta 이벤트 전송은 아직 하지 않는다.**

따라서 다음 순서는 아래가 맞다.

1. GTM Preview 전용 no-send 태그/트리거 후보를 만든다.
2. Preview에서 옵션 드롭다운 0건, 실제 `정기구독 신청` 1건을 확인한다.
3. 이후 운영 반영 경로를 GTM publish로 할지, Imweb footer로 할지 결정한다.

## GTM으로 가능한 이유

라이브 HTML 기준 실제 정기구독 신청 버튼은 GTM이 읽을 수 있는 속성을 갖고 있다.

PC 신청 버튼의 핵심 조건:

```text
path=/subscription/
class contains im-regularly
data-bs-content=purchase
data-bs-payment-button-type=imweb_payment
data-bs-is-regularly-prod=true
button text=정기구독 신청
```

모바일 최종 신청 버튼도 같은 핵심 속성을 갖는다.

반대로 옵션 드롭다운과 모바일 옵션 열기 버튼은 이 조건을 모두 갖지 않는다.

따라서 GTM의 Click Element 또는 Custom HTML listener에서 `closest(...)` 기준으로 아래 selector를 검사하면 구독 intent를 분리할 수 있다.

```css
a.im-regularly[data-bs-is-regularly-prod="true"][data-bs-content="purchase"][data-bs-payment-button-type="imweb_payment"]
```

단순 CSS selector만으로 끝내기보다 Custom JS에서 `closest('a,button,[role="button"]')`를 쓰는 것이 안전하다. 사용자가 버튼 안쪽 span이나 icon을 누르면 실제 클릭 target이 anchor가 아닐 수 있기 때문이다.

## 추천 GTM Preview 설계

### 태그

태그 이름 후보:

```text
AGENTSOS - [no-send] coffee_subscribe_intent_preview
```

태그 타입:

```text
Custom HTML
```

동작:

- 실제 `fbq(...)` 호출 없음
- 실제 GA4/Google Ads/Naver/Meta collect 없음
- `dataLayer.push({ event: 'coffee_subscribe_intent_preview', ... })`만 수행
- `window.__THECLEANCOFFEE_SUBSCRIBE_INTENT_PREVIEW_LAST__`에 마지막 payload 저장
- `sessionStorage` dedupe key로 1.5초 안 중복 클릭 1건 처리

### 트리거

Preview용 1차 추천:

```text
DOM Ready
Page Path matches RegEx ^/subscription/?$
```

이 트리거는 listener를 설치하는 역할만 한다. 실제 preview event는 클릭 시점에 `dataLayer.push`된다.

대안:

```text
Click - All Elements
Page Path matches RegEx ^/subscription/?$
Custom JS variable: Coffee Subscribe Intent Valid Click equals true
```

대안도 가능하지만, 금액 파싱, product code hash, dedupe, preview history를 한 곳에서 관리하려면 Custom HTML listener 방식이 더 단순하다.

### Preview payload

GTM에서도 기존 no-send snippet과 같은 정책을 쓴다.

```js
{
  event: 'coffee_subscribe_intent_preview',
  eventName: 'SubscribeIntentPreview',
  noSend: true,
  noFbq: true,
  noPixelRequest: true,
  customData: {
    intent_type: 'subscription_application',
    currency: 'KRW',
    value_status: 'present_or_missing',
    product_idx: '74',
    product_code_present: true,
    product_code_hash: '{hash}',
    payment_button_type: 'imweb_payment',
    is_regularly_prod: true
  }
}
```

raw product code, order id, member id, click id, phone, email은 넣지 않는다.

## GTM 방식의 장점

1. Imweb 전체 footer를 다시 저장하지 않고 Preview 검증이 가능하다.
2. Tag Assistant에서 어떤 클릭이 trigger를 통과했는지 보기 쉽다.
3. 나중에 운영 반영을 하더라도 GTM version rollback이 Imweb 전체 코드 롤백보다 빠르다.
4. Coffee GTM에는 이미 정기구독 완료/해지 GA4 태그가 있다. 다만 현재 필요한 것은 완료가 아니라 신청 intent라 별도 preview가 필요하다.

## GTM 방식의 한계

1. GTM Preview 실행 자체는 Yellow Lane이다. fresh workspace, backup, live version unchanged 확인이 필요하다.
2. Production publish는 Red Lane이다. no-send라 해도 live tracking layer 변경이기 때문이다.
3. 실제 Meta custom event로 바꿀 때는 Phase 9 footer mirror와 dedupe 계약을 다시 봐야 한다. `SubscribeIntentPreview`는 현재 Phase 9의 `MIRROR_EVENTS` 목록에 없다.
4. GTM이 먼저 로드되고 footer Phase 9는 나중에 로드된다. no-send는 문제 없지만, 실제 Meta 전송으로 바꾸면 `fbq` wrapper 설치 순서와 eventID 공급 방식을 검증해야 한다.
5. GTM built-in click trigger만 쓰면 클릭 target이 child node일 때 조건이 흔들릴 수 있다. 그래서 Custom JS `closest(...)`가 필요하다.

## Footer 방식의 장점과 한계

Footer 방식은 기존 Coffee attribution 코드와 같은 위치에서 관리된다. `__seo_funnel_session`, payment_success, checkout-context 같은 기존 first-party 키와 맞추기 쉽다.

하지만 지금은 단점이 더 크다.

- Imweb footer 저장은 전체 운영 사이트 script 변경이다.
- full paste 후보에 블록을 넣으면 변경 범위가 커 보인다.
- 검증 실패 시 Imweb 코드 롤백 범위가 GTM보다 크다.

따라서 지금 단계에서는 footer 통합을 보류하고, GTM Preview 후보를 먼저 보는 편이 낫다.

## 운영 반영 판단

현재 추천:

```text
1순위: GTM Preview no-send 설계/검증
2순위: Preview PASS 후 운영 반영 경로 결정
3순위: 운영 반영은 GTM publish와 Imweb save 중 하나만 선택
```

GTM Preview에서 확인할 성공 기준:

1. 옵션 드롭다운 클릭: `coffee_subscribe_intent_preview` 0건
2. 일반 구매 버튼 클릭: 0건
3. 정기구독 장바구니 클릭: 0건
4. 모바일 옵션 열기 버튼: 0건
5. PC `정기구독 신청` 최종 버튼: 1건
6. 모바일 최종 `정기구독` 버튼: 1건
7. 외부 네트워크 전송: 0건
8. GTM live version unchanged

## 지금 하지 않을 것

- GTM workspace 생성/수정
- GTM Production publish
- Imweb footer 저장
- Meta browser event send
- Meta CAPI send
- GA4/Google Ads/Naver 전송
- 운영DB 또는 VM Cloud SQLite write

## 다음 판단

`Coffee full paste 후보에 구독 no-send preview 블록을 통합`은 보류한다.

먼저 `GTM Preview no-send` 후보를 만든다. Preview에서 버튼 분리 조건이 통과하면, 운영 반영 경로를 GTM으로 할지 footer로 할지 결정한다.
