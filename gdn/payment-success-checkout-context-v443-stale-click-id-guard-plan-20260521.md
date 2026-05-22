# payment_success/checkout_context v4.4.3 stale click id guard 보강안

작성 시각: 2026-05-21 17:59 KST
기준일: 2026-05-21
문서 성격: Green Lane 보강안 / Imweb 운영 스크립트 v4.4.3 반영 전 승인 패킷

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - data/!data_inventory.md
    - gdn/google-paid-click-intent-gad-campaignid-gtm-hardening-plan-20260521.md
  required_context_docs:
    - docurule.md
  lane: Green for diagnosis and plan; Red for Imweb production custom-code publish
  allowed_actions:
    - live HTML read-only fetch
    - VM Cloud SQLite read-only query
    - local simulation and document creation
    - approval packet drafting
  forbidden_actions:
    - Imweb live custom-code edit without approval
    - GTM production publish
    - backend deploy
    - production or VM Cloud DB write
    - external platform send
  source_window_freshness_confidence:
    source: VM Cloud attribution_ledger/paid_click_intent_ledger + live biocom.kr HTML
    window: recent 24h plus TJ님 2026-05-21 Google click/order test rows
    freshness: 2026-05-21 17:59 KST
    confidence: 0.96
```

## 10초 요약

Google 광고 클릭에는 새 `gclid`와 `gbraid`만 있었는데, 주문완료 원장에는 예전 테스트 `wbraid=test_wbraid_20260514`가 같이 붙었다. 즉 광고 클릭 자체가 잘못된 것이 아니라, 결제 흐름에서 저장해 둔 클릭 ID를 합칠 때 서로 다른 시점의 값을 섞는 문제가 있다.

v4.4.3의 핵심은 `gclid`, `gbraid`, `wbraid`를 각각 따로 fallback 하지 않고, 한 출처에서 온 Google click id 묶음만 선택하는 것이다. 이렇게 하면 새 `gclid+gbraid` 주문에 오래된 `wbraid`가 따라붙지 않는다.

이 문서는 보강안이다. 실제 Imweb 운영 스크립트 수정은 사이트 전체 결제 추적에 영향이 있으므로 TJ님 승인 후 진행한다.

## 현재 관측

최근 테스트 클릭 URL에는 `gclid`, `gbraid`, `gad_campaignid`가 있었고 `wbraid`는 없었다.

`paid_click_intent_ledger`는 GTM v3 이후 새 클릭을 정상 저장했다. 새 클릭 row에는 `gclid`, `gbraid`, `gad_campaignid`가 있었고, stale `wbraid`는 없었다.

문제는 `payment_success` 쪽에서 나타났다. VM Cloud `attribution_ledger.payment_success` 최근 24시간 기준 `metadata.wbraid=test_wbraid_20260514` row가 3건 있었고, 모두 `click_id_restore_source=checkout_context`였다. 대표 주문은 `202605218967500`, `202605214186402`, `202605219787067`이다.

따라서 이번 원인은 GTM paid-click-intent 태그보다, Imweb 결제 흐름의 `checkout_context`와 `payment_success` 스크립트가 오래된 저장값을 새 클릭값과 섞는 쪽에 있다.

source: VM Cloud SQLite `attribution_ledger`, `paid_click_intent_ledger`; live HTML `biocom.kr/mineraltest_store/?idx=6`
window: 2026-05-21 최근 24h 및 TJ님 수동 Google 광고 테스트 주문
freshness: 2026-05-21 17:59 KST
confidence: 0.96

## 왜 문제가 되는가

`gclid`, `gbraid`, `wbraid`는 모두 Google 클릭을 식별하는 값이지만 같은 클릭에서 동시에 아무 값이나 섞어 쓰는 필드는 아니다.

현재 v4.4.2는 `gclid`는 새 저장소에서, `gbraid`도 새 저장소에서, `wbraid`는 예전 저장소에서 각각 따로 첫 값을 고른다. 그래서 실제 URL에 `wbraid`가 없는데도 과거 테스트 `wbraid`가 주문에 붙을 수 있다.

이 상태로 Google ROAS 계산이나 향후 전환 업로드를 하면, 한 주문이 실제 클릭과 다른 클릭 증거를 함께 가진 것처럼 보인다. 내부 원장 기준 매출 자체는 유지되지만, 광고 클릭-주문 연결 evidence의 신뢰도가 떨어진다.

## v4.4.3 보강 원칙

Google click id는 세 필드를 독립 fallback 하지 않는다.

대신 후보 출처를 우선순위대로 보고, Google click id가 하나라도 있는 첫 출처의 묶음을 통째로 선택한다.

추천 우선순위는 다음과 같다.

1. 현재 URL query: 실제 랜딩 URL에 남은 `gclid/gbraid/wbraid`.
2. `document.referrer`: 결제 페이지로 넘어오기 직전 상품/랜딩 URL.
3. `__seo_checkout_context`: 결제 시작 시점에 저장한 checkout context.
4. `__biocom_click_id_context_v1`: GTM paid click intent가 보강한 클릭 context.
5. `_p1s1a_last_touch`: 기존 first-party last-touch 저장소.
6. `__bs_imweb_session`: Imweb session fallback.

선택된 출처가 `gclid+gbraid`만 가지고 있으면 `wbraid`는 빈 값으로 둔다. 반대로 선택된 출처가 `wbraid`만 가진 iOS 계열 클릭이면 `wbraid`는 유지한다.

UTM, campaign id, order id, payment code 같은 다른 필드는 기존처럼 병합해도 된다. 하지만 Google click id 3종은 같은 출처 묶음으로만 다룬다.

## 구현 설계

### 1. 공통 helper 추가

`checkout_context` 블록과 `payment_success` 블록에 같은 helper를 둔다.

```js
function googleClickSetFrom(source, sourceName) {
  return {
    source: sourceName,
    gclid: trim(source && source.gclid),
    gbraid: trim(source && source.gbraid),
    wbraid: trim(source && source.wbraid),
  };
}

function googleClickSetFromUrl(urlLike, sourceName) {
  try {
    var url = new URL(urlLike, location.origin);
    return googleClickSetFrom({
      gclid: url.searchParams.get('gclid'),
      gbraid: url.searchParams.get('gbraid'),
      wbraid: url.searchParams.get('wbraid'),
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
    if (hasGoogleClickSet(candidates[i])) {
      return candidates[i];
    }
  }
  return googleClickSetFrom({}, 'none');
}
```

### 2. checkout_context 저장 규칙 변경

현재 v4.4.2는 `tracking.gclid`, `tracking.gbraid`, `tracking.wbraid`를 각각 fallback 한다. v4.4.3에서는 결제 진입 시 `selectedGoogleClickSet`을 만들고, checkout context에 이 묶음만 저장한다.

권장 후보 순서:

```js
var selectedGoogleClickSet = selectGoogleClickSet([
  googleClickSetFromUrl(location.href, 'current_url'),
  googleClickSetFromUrl(document.referrer, 'document_referrer'),
  googleClickSetFrom(clickContext, 'click_context'),
  googleClickSetFrom(lastTouch, 'last_touch'),
  googleClickSetFrom(imwebSession, 'imweb_session'),
]);
```

저장값:

```js
gclid: selectedGoogleClickSet.gclid,
gbraid: selectedGoogleClickSet.gbraid,
wbraid: selectedGoogleClickSet.wbraid,
google_click_id_source: selectedGoogleClickSet.source,
google_click_id_guard_version: 'v4.4.3',
```

이렇게 하면 결제 페이지 URL에 click id가 없어도, 직전 상품 페이지 referrer 또는 GTM click context에서 온 한 묶음만 저장된다.

### 3. payment_success 전송 규칙 변경

주문완료 페이지에서는 기존 `checkoutContext`를 가장 먼저 신뢰한다. 단, 여기서도 세 click id를 따로 섞지 않는다.

권장 후보 순서:

```js
var selectedGoogleClickSet = selectGoogleClickSet([
  googleClickSetFromUrl(location.href, 'current_url'),
  googleClickSetFrom(checkoutContext, 'checkout_context'),
  googleClickSetFromUrl(document.referrer, 'document_referrer'),
  googleClickSetFrom(clickContext, 'click_context'),
  googleClickSetFrom(lastTouch, 'last_touch'),
  googleClickSetFrom(imwebSession, 'imweb_session'),
]);
```

`payment_success` payload metadata는 다음처럼 바꾼다.

```js
gclid: selectedGoogleClickSet.gclid,
gbraid: selectedGoogleClickSet.gbraid,
wbraid: selectedGoogleClickSet.wbraid,
has_gbraid: Boolean(selectedGoogleClickSet.gbraid),
has_wbraid: Boolean(selectedGoogleClickSet.wbraid),
click_id_restore_source: selectedGoogleClickSet.source,
google_click_id_guard_version: 'v4.4.3',
```

현재 `click_id_restore_source`는 사실상 `gclid` 복원 출처 중심이라 `wbraid` 혼입 원인을 늦게 찾게 만든다. v4.4.3부터는 선택된 Google click id 묶음 출처를 그대로 남긴다.

### 4. dedupe key는 보수적으로 유지

스크립트 버전 표시는 v4.4.3으로 올리되, `payment_success` dedupe prefix는 특별한 이유가 없으면 v4.4.2와 같은 order-level dedupe를 유지한다.

이유는 단순하다. 이번 보강은 event를 더 많이 보내기 위한 것이 아니라 같은 주문의 click evidence를 더 깨끗하게 만들기 위한 것이다. dedupe prefix까지 바꾸면 과거 주문완료 페이지 재방문 때 중복 row가 생길 수 있다.

## 테스트 케이스

Green Lane에서 먼저 로컬 fixture 또는 브라우저 콘솔 시뮬레이션으로 확인한다.

1. 새 referrer에 `gclid+gbraid`가 있고 저장소에 `test_wbraid_20260514`가 있을 때, checkout context와 payment_success 모두 `wbraid=""`가 되어야 한다.
2. 새 referrer에 `wbraid`만 있는 iOS 계열 클릭이면 `wbraid`가 유지되어야 한다.
3. 현재 URL과 referrer에 click id가 없고 checkout context만 있으면 checkout context의 묶음을 그대로 써야 한다.
4. `paid_click_intent_ledger`에는 새 클릭 row가 계속 `gad_campaignid`, `gclid/gbraid/wbraid_present`를 저장해야 한다.
5. 가상계좌 미입금 주문은 내부 원장에는 `pending`으로 남고, Meta Purchase나 Google 전환 전송으로 확대되지 않아야 한다.

운영 반영 후 smoke 기준:

1. TJ님이 Google 광고 1회 클릭 후 가상계좌 미입금 주문을 만든다.
2. VM Cloud `paid_click_intent_ledger`에서 해당 `gclid` row가 확인된다.
3. VM Cloud `attribution_ledger.payment_success`에서 해당 주문 metadata에 실제 URL에 없던 stale `wbraid`가 없어야 한다.
4. `click_id_restore_source`는 `checkout_context`, `document_referrer`, `click_context` 중 하나로 남되, 세 click id가 같은 출처 묶음이어야 한다.
5. `payment_status=pending` 주문이 platform purchase/send로 승격되지 않아야 한다.

## 승인안

승인 요청 이름: Imweb 결제 추적 custom code v4.4.3 운영 반영.

무엇을 바꾸는가: `checkout_context`와 `payment_success`에서 Google click id를 한 출처 묶음으로 선택하도록 바꾼다.

왜 필요한가: 새 Google 클릭에 오래된 `wbraid`가 섞이면 내부 confirmed ROAS 계산의 주문-광고 연결 evidence가 흐려진다.

바꾸면 생기는 효과: `gclid+gbraid` 클릭 주문에는 실제 클릭에 없던 `wbraid`가 붙지 않는다. `wbraid`만 있는 실제 클릭은 계속 보존된다.

안 바꾸면 남는 문제: 앞으로도 `checkout_context`가 예전 저장값을 섞어 `payment_success`에 stale `wbraid`를 보낼 수 있다.

Codex가 대신 못 하는 이유: Imweb 운영 custom code 수정은 라이브 결제 추적 경로를 바꾸는 Red Lane 작업이다. TJ님 승인 없이 운영 반영하지 않는다.

의존성: backend 배포는 필수 아니다. GTM v3는 이미 paid-click-intent 쪽을 보강했으므로, 이번 v4.4.3은 Imweb 결제 스크립트 쪽 후속 보강이다.

실패 시 rollback: 기존 v4.4.2 custom code 백업본으로 즉시 복원한다. 복원 후 같은 주문 재조회에서 신규 row를 만들지 않도록 dedupe prefix는 보수적으로 유지한다.

추천 점수/자신감: 92%. 원인은 `payment_success`가 아니라 더 앞단의 `checkout_context` 혼합 규칙까지 이어져 있어, 이번 보강이 stale `wbraid` 제거에 직접적이다.

## 다음 할일

1. Codex가 로컬 v4.4.3 fixture smoke를 만든다.
무엇을/왜: 운영에 넣기 전, 새 `gclid+gbraid`와 stale `wbraid`가 같이 있을 때 `wbraid`가 비워지는지 확인한다.
어떻게/어디서: 로컬 JS fixture로 `current_url`, `document_referrer`, `checkout_context`, `click_context`, `last_touch` 후보를 주입해 `selectGoogleClickSet` 결과를 비교한다.
누가: Codex.
승인 필요 여부: NO, Green Lane.
성공 기준: 5개 테스트 케이스가 모두 통과하고, stale `test_wbraid_20260514`가 payload에 남지 않는다.
실패 시 확인점: 후보 우선순위가 너무 공격적인지, checkout page에서 referrer가 실제로 보존되는지 확인한다.
의존성: 없음.
추천 점수/자신감: 95%.

2. TJ님이 Imweb v4.4.3 운영 반영을 승인한다.
무엇을/왜: 실제 결제 흐름에서 stale `wbraid` 혼입을 막기 위해 운영 custom code를 바꾼다.
어떻게/어디서: TJ님이 이 대화에 `Imweb v4.4.3 운영 반영 승인`이라고 답하면 된다.
누가: TJ님 승인, Codex가 반영 지원.
승인 필요 여부: YES, Red Lane.
성공 기준: 운영 HTML에서 version marker가 v4.4.3으로 확인된다.
실패 시 확인점: Imweb custom code 저장/캐시 반영 지연, 기존 코드 백업 누락 여부를 확인한다.
의존성: 1번 로컬 fixture smoke 후 진행 권장.
추천 점수/자신감: 90%.

3. 운영 반영 후 TJ님이 Google 광고 클릭-가상계좌 미입금 주문 1회를 만든다.
무엇을/왜: 실제 브라우저/광고/Imweb 결제 흐름에서 click id가 깨끗하게 이어지는지 확인한다.
어떻게/어디서: Google 광고 클릭 URL, `/shop_payment/` URL, `/shop_payment_complete` URL, 주문시각을 이 대화에 남긴다.
누가: TJ님. Codex가 광고 클릭을 대신하면 계정/브라우저/광고 노출 조건이 달라져 검증력이 떨어진다.
승인 필요 여부: NO, 테스트 주문 생성만 필요. 단 실제 결제 입금은 하지 않는다.
성공 기준: VM Cloud `payment_success` metadata에 stale `wbraid`가 없고, 실제 click id와 `gad_campaignid`가 연결된다.
실패 시 확인점: referrer 손실, storage stale 값, Imweb custom code 캐시, 특정 브라우저 extension 개입을 분리한다.
의존성: 2번 운영 반영 이후.
추천 점수/자신감: 88%.
