# Imweb payment_success/checkout_context v4.4.3 수정 필요 지점 문서

작성 시각: 2026-05-21 18:07 KST
기준일: 2026-05-21
문서 성격: 현재 아임웹 헤더/푸터 코드 기준 수정 지점 맵 / 운영 반영 전 승인 참고문서

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - data/!data_inventory.md
    - gdn/payment-success-checkout-context-v443-stale-click-id-guard-plan-20260521.md
  required_context_docs:
    - docurule.md
  lane: Green for documentation; Red for Imweb production custom-code edit
  allowed_actions:
    - provided code review
    - change-map document creation
    - no-send/no-write design
  forbidden_actions:
    - Imweb live custom-code edit without TJ approval
    - backend deploy
    - GTM production publish
    - VM Cloud or production DB write
    - Meta/Google/TikTok platform send
  source_window_freshness_confidence:
    source: TJ님 제공 Imweb header/body/footer code + VM Cloud stale wbraid diagnosis
    window: 2026-05-21 current Imweb code snapshot
    freshness: 2026-05-21 18:07 KST
    confidence: 0.96
```

## 10초 요약

v4.4.3은 백엔드만 바꾸는 작업이 아니다. 현재 stale `wbraid` 혼입은 아임웹 헤더/푸터 코드가 Google click id를 저장하고 결제 payload를 만들 때 서로 다른 출처의 `gclid`, `gbraid`, `wbraid`를 각각 따로 병합해서 생긴다.

수정해야 할 곳은 4개다.

1. 헤더 코드 상단 `BI / Google Click ID Bootstrap v1`
2. 푸터 코드 `Block 1: UTM persistence + Google click-id preservation v4.1`
3. 푸터 코드 `Block 2: checkout_started 이벤트 + Google click-id checkout context v4.2`
4. 푸터 코드 `Block 3: payment_page_seen / payment_success split v4.4.2`

수정하지 않아도 되는 곳은 payment-decision guard, Direct Meta Pixel Base, TikTok guard, GTM canonical, body noscript, Keepgrow, Beusable, Phase 9 CAPI mirror, Block 4 Meta fallback이다.

## 핵심 수정 원칙

Google click id 3종은 다음처럼 따로 병합하면 안 된다.

```js
gclid: firstNonEmpty([incoming.gclid, previous.gclid])
gbraid: firstNonEmpty([incoming.gbraid, previous.gbraid])
wbraid: firstNonEmpty([incoming.wbraid, previous.wbraid])
```

이 방식은 새 URL에 `gclid+gbraid`만 있고 과거 저장소에 `wbraid`가 있으면, 새 `gclid+gbraid`와 과거 `wbraid`를 하나의 주문에 섞는다.

v4.4.3의 원칙은 한 문장이다.

Google click id는 `gclid`, `gbraid`, `wbraid`를 각각 고르지 않고, 한 출처에서 온 묶음을 통째로 고른다.

공통 helper 방향:

```js
function googleClickSetFrom(source, sourceName) {
  return {
    source: sourceName,
    gclid: trim(source && source.gclid),
    gbraid: trim(source && source.gbraid),
    wbraid: trim(source && source.wbraid)
  };
}

function googleClickSetFromUrl(urlLike, sourceName) {
  try {
    var url = new URL(urlLike, location.origin);
    return googleClickSetFrom({
      gclid: url.searchParams.get('gclid'),
      gbraid: url.searchParams.get('gbraid'),
      wbraid: url.searchParams.get('wbraid')
    }, sourceName);
  } catch (error) {
    return googleClickSetFrom({}, sourceName);
  }
}

function hasGoogleClickSet(set) {
  return Boolean(set && (set.gclid || set.gbraid || set.wbraid));
}

function selectGoogleClickSet(candidates) {
  for (var i = 0; i < candidates.length; i += 1) {
    if (hasGoogleClickSet(candidates[i])) return candidates[i];
  }
  return googleClickSetFrom({}, 'none');
}
```

## 수정 대상 1. 헤더 코드 상단 BI / Google Click ID Bootstrap v1

현재 위치:

`<헤더 코드 상단>`의 `<!-- BI / Google Click ID Bootstrap v1 -->` 블록.

현재 문제:

`mergeTouch(previous, incoming, options)`에서 `gclid`, `gbraid`, `wbraid`를 각각 `firstNonEmpty`로 병합한다. 이 블록은 가장 먼저 `__biocom_click_id_context_v1`, `__biocom_click_ids`, `_p1s1a_first_touch`, `_p1s1a_last_touch`, `_p1s1a_session_touch`를 쓰므로, 여기서 stale `wbraid`가 섞이면 이후 푸터가 그 값을 계속 읽는다.

필요 수정:

1. `VERSION`을 예를 들어 `2026-05-21-biocom-click-id-bootstrap-v1-1`로 올린다.
2. `mergeTouch()` 안에서 Google click id는 `selectGoogleClickSet()` 결과로 넣는다.
3. `fbclid`, `ttclid`는 기존처럼 독립 fallback을 유지해도 된다. 문제는 Google click id 3종 혼합이다.
4. 저장 객체에 `google_click_id_source`, `google_click_id_guard_version: 'v4.4.3'`를 남긴다.

권장 merge 방향:

```js
var googleCandidates = preferIncomingForClickId
  ? [
      googleClickSetFrom(incoming, 'incoming'),
      googleClickSetFrom(previous, 'previous')
    ]
  : [
      googleClickSetFrom(previous, 'previous'),
      googleClickSetFrom(incoming, 'incoming')
    ];

var selectedGoogleClickSet = selectGoogleClickSet(googleCandidates);

// merged 안의 Google click id 3종
gclid: selectedGoogleClickSet.gclid,
gbraid: selectedGoogleClickSet.gbraid,
wbraid: selectedGoogleClickSet.wbraid,
google_click_id_source: selectedGoogleClickSet.source,
google_click_id_guard_version: 'v4.4.3',
```

기대 효과:

새 Google 광고 URL에 `gclid+gbraid`만 있으면 이전 저장소의 `wbraid`를 끌고 오지 않는다. 반대로 실제 `wbraid`만 있는 클릭이면 그 묶음은 유지된다.

## 수정 대상 2. 푸터 Block 1 UTM persistence + Google click-id preservation v4.1

현재 위치:

`<푸터 코드>`의 `/* ── Block 1: UTM persistence + Google click-id preservation v4.1 ── */`.

현재 문제:

`mergeTouch(previous, incoming, options)`가 다시 `gclid`, `gbraid`, `wbraid`를 독립 fallback 한다. 헤더 bootstrap에서 깨끗하게 저장해도 Block 1이 `clickContext`, `lastTouch`, `sessionTouch`를 다시 섞을 수 있다.

필요 수정:

1. `snippetVersion`을 예를 들어 `2026-05-21-biocom-footer-block1-click-id-v4-2`로 올린다.
2. Block 1에도 동일한 Google click set helper를 넣는다.
3. `mergeTouch()`에서 Google click id 3종은 선택된 한 묶음만 사용한다.
4. `enrichWithClickContext(tracking)`은 기존 구조를 유지하되, 내부 `mergeTouch(clickContext, tracking, ...)`가 atomic Google click set을 쓰게 만든다.

주의:

첫 유입 UTM identity를 유지하는 기존 정책은 바꾸지 않는다. 바꾸는 것은 Google click id 3종의 병합 방식뿐이다.

기대 효과:

`_p1s1a_last_touch`와 `_p1s1a_session_touch`가 새 `gclid+gbraid`에 과거 `wbraid`를 붙여 저장하는 일을 막는다.

## 수정 대상 3. 푸터 Block 2 checkout_started / checkout_context v4.2

현재 위치:

`<푸터 코드>`의 `/* ── Block 2: checkout_started 이벤트 + Google click-id checkout context v4.2 ── */`.

현재 문제:

`tracking` 생성부에서 아래처럼 각 Google click id를 따로 고른다.

```js
gclid: firstNonEmpty([
  getSearchParam(['gclid']),
  trim(clickContext.gclid),
  trim(lastTouch.gclid),
  trim(imwebSession.gclid)
])
```

`gbraid`, `wbraid`도 같은 구조다. 이 때문에 `gclid/gbraid`는 새 클릭, `wbraid`는 이전 저장소에서 오는 조합이 가능하다.

필요 수정:

1. `snippetVersion`을 예를 들어 `2026-05-21-biocom-checkout-started-click-id-v4-3`으로 올린다.
2. `tracking` base에서는 UTM, `fbclid`, `ttclid`, `fbc`, `fbp`만 기존 방식으로 구성한다.
3. Google click id는 별도 `selectedGoogleClickSet`으로 만든 뒤 `tracking.gclid/gbraid/wbraid`에 덮어쓴다.
4. `document.referrer`를 후보에 추가한다. 결제 페이지 URL에는 click id가 없고, 직전 상품/랜딩 URL referrer에 남는 경우가 있기 때문이다.
5. `mergeLandingParams()`가 Google click id 3종을 독립 병합하지 않게 제거하거나, 마지막에 `selectedGoogleClickSet`으로 반드시 덮어쓴다.

권장 후보 순서:

```js
var selectedGoogleClickSet = selectGoogleClickSet([
  googleClickSetFromUrl(location.href, 'current_url'),
  googleClickSetFromUrl(document.referrer, 'document_referrer'),
  googleClickSetFrom(clickContext, 'header_click_context'),
  googleClickSetFrom(lastTouch, 'last_touch'),
  googleClickSetFrom({
    gclid: imwebSession.gclid,
    gbraid: imwebSession.gbraid,
    wbraid: imwebSession.wbraid
  }, 'imweb_session')
]);
```

저장해야 할 추가 metadata:

```js
google_click_id_source: selectedGoogleClickSet.source,
google_click_id_guard_version: 'v4.4.3'
```

`__seo_checkout_context`에도 같은 값을 넣는다.

```js
gclid: selectedGoogleClickSet.gclid,
gbraid: selectedGoogleClickSet.gbraid,
wbraid: selectedGoogleClickSet.wbraid,
googleClickIdSource: selectedGoogleClickSet.source,
googleClickIdGuardVersion: 'v4.4.3',
```

기대 효과:

결제 시작 시점에 `__seo_checkout_context`가 깨끗해진다. 이 값이 주문완료 페이지의 primary evidence가 되므로, Block 2 수정이 가장 중요하다.

## 수정 대상 4. 푸터 Block 3 payment_page_seen / payment_success split v4.4.2

현재 위치:

`<푸터 코드>`의 `/* ── Block 3: payment_page_seen / payment_success split v4.4.2 ── */`.

현재 문제:

`buildCommonContext()`에서 `checkoutContext`, `clickContext`, `lastTouch`, `imwebSession`의 `gclid`, `gbraid`, `wbraid`를 다시 각각 fallback 한다.

또한 `payment_success` metadata의 `click_id_restore_source`가 `gclid` 기준으로만 계산된다. 그래서 `wbraid`가 어디서 왔는지 늦게 파악하게 된다.

필요 수정:

1. `snippetVersion`, `pageSeenVersion`, `paymentSuccessVersion`을 v4.4.3으로 올린다.
2. `buildCommonContext()`에서 Google click id 3종은 `selectedGoogleClickSet`으로 만든다.
3. versioned checkout context를 우선 사용한다. 단 `googleClickIdGuardVersion === 'v4.4.3'`가 없는 legacy checkout context는 하위 후보로 둔다.
4. `click_id_restore_source`는 `gclid` 출처가 아니라 선택된 Google click id 묶음의 출처를 기록한다.
5. `paymentSuccessContextKey`에 `googleClickIdSource`, `googleClickIdGuardVersion`을 남긴다.

권장 후보 순서:

```js
var versionedCheckoutContext = trim(checkoutContext.googleClickIdGuardVersion) === 'v4.4.3'
  ? checkoutContext
  : {};

var legacyCheckoutContext = trim(checkoutContext.googleClickIdGuardVersion) === 'v4.4.3'
  ? {}
  : checkoutContext;

var selectedGoogleClickSet = selectGoogleClickSet([
  googleClickSetFromUrl(location.href, 'current_url'),
  googleClickSetFrom(versionedCheckoutContext, 'checkout_context_v4_4_3'),
  googleClickSetFromUrl(document.referrer, 'document_referrer'),
  googleClickSetFrom(clickContext, 'header_click_context'),
  googleClickSetFrom(lastTouch, 'last_touch'),
  googleClickSetFrom({
    gclid: imwebSession.gclid,
    gbraid: imwebSession.gbraid,
    wbraid: imwebSession.wbraid
  }, 'imweb_session'),
  googleClickSetFrom(legacyCheckoutContext, 'legacy_checkout_context')
]);
```

`payment_success` metadata 변경:

```js
google_click_id_source: selectedGoogleClickSet.source,
google_click_id_guard_version: 'v4.4.3',
click_id_restore_source: selectedGoogleClickSet.source,
gbraid: selectedGoogleClickSet.gbraid,
wbraid: selectedGoogleClickSet.wbraid,
```

dedupe 주의:

`paymentSuccessDedupePrefix`는 꼭 바꿀 필요가 없다. v4.4.3 smoke를 위해 dedupe prefix까지 바꾸면 기존 주문완료 페이지 재방문에서 중복 row가 생길 수 있다. 버전 marker는 올리되, dedupe는 기존 order-level dedupe를 유지하는 쪽이 안전하다.

기대 효과:

주문완료 원장에 새 Google 클릭값과 과거 `wbraid`가 섞이지 않는다. 이후 Google ROAS 정합성 계산에서 주문-광고 연결 evidence의 신뢰도가 올라간다.

## 수정하지 않을 블록

이번 v4.4.3에서 건드리지 않는 것이 맞는 블록은 다음과 같다.

1. `server-payment-decision-guard-v3-1-1`: Meta Purchase를 confirmed/pending 기준으로 막거나 허용하는 guard다. stale `wbraid` 생성 원인이 아니다.
2. `Biocom Direct Meta Pixel Base v0.2`: PageView만 쏘며 Google click id storage를 만지지 않는다.
3. `TikTok Purchase Guard`: TikTok purchase guard와 event log는 Google `gclid/gbraid/wbraid` 혼입 원인이 아니다.
4. `Google Tag Manager - Biocom Canonical`: GTM loader 자체는 유지한다. paid-click-intent v3는 별도 GTM 영역이며, 이번 Imweb checkout 보강과 충돌하지 않는다.
5. body의 GTM noscript, Keepgrow script: 수정 대상 아님.
6. `Phase 9 Funnel CAPI mirror`: Purchase를 제외한 Meta funnel mirror이며 이번 Google click id 혼입 원인이 아니다.
7. `Block 4 Meta browser funnel image-beacon fallback`: AddToCart/InitiateCheckout/AddPaymentInfo fallback이며 Google click id 저장 로직이 아니다.

## 운영 반영 순서

1. 로컬 fixture로 Google click id atomic merge helper를 검증한다.
2. 아임웹 현재 헤더/푸터 코드를 백업한다.
3. 헤더 bootstrap v1을 v1.1로 수정한다.
4. 푸터 Block 1을 v4.2로 수정한다.
5. 푸터 Block 2를 v4.3으로 수정한다.
6. 푸터 Block 3을 v4.4.3으로 수정한다.
7. 운영 HTML에서 새 version marker 4종을 확인한다.
8. TJ님이 Google 광고 클릭 후 가상계좌 미입금 주문 1건을 만든다.
9. VM Cloud에서 `paid_click_intent_ledger`와 `attribution_ledger.payment_success`를 read-only로 비교한다.

## 성공 기준

새 테스트 주문 기준으로 다음이 모두 만족되어야 한다.

1. 클릭 URL에 `wbraid`가 없으면 `payment_success.metadata.wbraid`도 비어 있어야 한다.
2. 클릭 URL에 `gclid`와 `gbraid`가 있으면 둘은 보존되어야 한다.
3. `payment_success.metadata.google_click_id_source`가 남아야 한다.
4. `paid_click_intent_ledger`의 `gad_campaignid`, `gclid`, `gbraid_present`가 계속 보존되어야 한다.
5. 가상계좌 미입금 주문은 pending으로 남고 Meta/Google Purchase 전송으로 승격되면 안 된다.

## 승인안

승인 요청 이름: Imweb Google click id atomic merge v4.4.3 운영 반영.

내가 실제로 바꾸는 화면: 아임웹 사이트 설정의 헤더/푸터 custom code 영역.

바꾸는 설정 이름: 헤더 코드 상단 `BI / Google Click ID Bootstrap v1`, 푸터 코드 `Block 1`, `Block 2`, `Block 3`.

바꾸면 생기는 효과: 새 Google 광고 클릭에서 온 `gclid/gbraid`와 예전 저장소의 stale `wbraid`가 같은 주문에 섞이지 않는다.

안 바꾸면 남는 문제: `checkout_context`와 `payment_success`가 이전 저장소 값을 계속 섞어서 내부 confirmed ROAS의 주문-광고 연결 evidence가 오염될 수 있다.

승인 필요 여부: YES. 아임웹 운영 custom code 변경은 사이트 전체 결제 추적에 영향을 주는 Red Lane이다.

의존성: backend 배포는 필수 아니다. GTM v3는 paid-click-intent 쪽을 이미 보강했으므로, 이번 작업은 아임웹 결제 흐름의 별도 보강이다.

추천 점수/자신감: 92%.

## 다음 할일

1. Codex가 v4.4.3 helper fixture를 만든다.
무엇을/왜: 운영 코드에 넣기 전에 `gclid+gbraid` 새 클릭과 stale `wbraid` 저장소 조합이 안전하게 처리되는지 검증한다.
어떻게/어디서: 로컬 JS fixture로 `incoming`, `previous`, `checkoutContext`, `clickContext`, `lastTouch` 후보를 넣어 결과를 비교한다.
누가: Codex.
성공 기준: 새 `gclid+gbraid` 선택 시 `wbraid`가 비고, 진짜 `wbraid` only 클릭은 유지된다.
실패 시 확인점: 후보 우선순위 또는 legacy checkout context 처리 순서.
승인 필요 여부: NO, Green Lane.
의존성: 없음.
추천 점수/자신감: 95%.

2. TJ님이 Imweb v4.4.3 운영 반영을 승인한다.
무엇을/왜: 실제 아임웹 결제 흐름에서 stale `wbraid` 혼입을 막는다.
어떻게/어디서: 이 대화에 `Imweb v4.4.3 운영 반영 승인`이라고 답하면 된다.
누가: TJ님 승인, Codex 반영 지원.
성공 기준: 운영 HTML에 새 version marker가 보이고, 새 테스트 주문의 `payment_success` metadata에 stale `wbraid`가 없다.
실패 시 확인점: 아임웹 custom code 저장 지연, 캐시, 기존 스크립트 중복 설치.
승인 필요 여부: YES, Red Lane.
의존성: 1번 fixture smoke 후 권장.
추천 점수/자신감: 90%.
