# Imweb v4.4.3 붙여넣기용 패치본

작성 시각: 2026-05-21 18:29 KST
기준일: 2026-05-21
문서 성격: 운영 반영 전 붙여넣기용 패치본 / 아임웹 헤더·푸터 custom code 교체 가이드

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - gdn/imweb-payment-success-checkout-context-v443-change-map-20260521.md
    - gdn/imweb-v443-click-id-fixture-smoke-result-20260521.md
  required_context_docs:
    - docurule.md
  lane: Green for patch drafting; Red for Imweb production custom-code edit
  allowed_actions:
    - paste-ready patch drafting
    - local fixture verification
    - no-send/no-write documentation
  forbidden_actions:
    - Imweb live custom-code edit without TJ approval
    - backend deploy
    - GTM production publish
    - VM Cloud or production DB write
    - Meta/Google/TikTok platform send
  source_window_freshness_confidence:
    source: TJ님 provided Imweb code + local fixture 7/7 PASS
    window: 2026-05-21 current Imweb header/footer snapshot
    freshness: 2026-05-21 18:29 KST
    confidence: 0.94
```

## 10초 요약

이 패치본은 아임웹 운영 코드에 바로 반영하기 위한 “찾기/교체” 단위 코드다. 바꾸는 곳은 헤더 상단 1개 블록과 푸터 3개 블록뿐이다.

핵심은 `gclid`, `gbraid`, `wbraid`를 각각 따로 fallback 하지 않고, 한 출처에서 온 Google click id 묶음만 선택하는 것이다. 이렇게 하면 새 `gclid+gbraid` 클릭에 과거 저장소의 stale `wbraid`가 붙지 않는다.

아직 운영에 반영한 것은 아니다. 아임웹 custom code 운영 반영은 Red Lane이므로 TJ님 승인 후 진행한다.

## 적용 전 백업

아임웹에 반영하기 전 아래 2개를 그대로 백업한다.

1. 헤더 코드 전체
2. 푸터 코드 전체

백업 파일명 추천:

```text
biocom-imweb-header-before-v443-20260521.html
biocom-imweb-footer-before-v443-20260521.html
```

## Patch 1. 헤더 상단 BI / Google Click ID Bootstrap v1

### 1-1. VERSION 교체

찾기:

```js
var VERSION = '2026-05-14-biocom-click-id-bootstrap-v1';
```

교체:

```js
var VERSION = '2026-05-21-biocom-click-id-bootstrap-v1-1';
var GOOGLE_CLICK_ID_GUARD_VERSION = 'v4.4.3';
```

### 1-2. helper 추가

위치: `function firstNonEmpty(values) { ... }` 바로 아래에 붙여넣는다.

```js
  function googleClickSetFrom(source, sourceName) {
    source = source && typeof source === 'object' ? source : {};
    return {
      source: sourceName,
      gclid: trim(source.gclid),
      gbraid: trim(source.gbraid),
      wbraid: trim(source.wbraid)
    };
  }

  function hasGoogleClickSet(set) {
    return Boolean(set && (trim(set.gclid) || trim(set.gbraid) || trim(set.wbraid)));
  }

  function selectGoogleClickSet(candidates) {
    for (var i = 0; i < candidates.length; i += 1) {
      if (hasGoogleClickSet(candidates[i])) return candidates[i];
    }
    return googleClickSetFrom({}, 'none');
  }
```

### 1-3. `mergeTouch` 함수 전체 교체

기존 `function mergeTouch(previous, incoming, options) { ... }` 전체를 아래로 교체한다.

```js
  function mergeTouch(previous, incoming, options) {
    previous = previous && typeof previous === 'object' ? previous : {};
    incoming = incoming && typeof incoming === 'object' ? incoming : {};
    options = options || {};

    var preferIncomingForUtm = options.preferIncomingForUtm !== false;
    var preferIncomingForClickId = options.preferIncomingForClickId !== false;

    var selectedGoogleClickSet = selectGoogleClickSet(
      preferIncomingForClickId
        ? [
            googleClickSetFrom(incoming, 'incoming'),
            googleClickSetFrom(previous, 'previous')
          ]
        : [
            googleClickSetFrom(previous, 'previous'),
            googleClickSetFrom(incoming, 'incoming')
          ]
    );

    var merged = {
      utm_source: preferIncomingForUtm
        ? firstNonEmpty([incoming.utm_source, previous.utm_source])
        : firstNonEmpty([previous.utm_source, incoming.utm_source]),

      utm_medium: preferIncomingForUtm
        ? firstNonEmpty([incoming.utm_medium, previous.utm_medium])
        : firstNonEmpty([previous.utm_medium, incoming.utm_medium]),

      utm_campaign: preferIncomingForUtm
        ? firstNonEmpty([incoming.utm_campaign, previous.utm_campaign])
        : firstNonEmpty([previous.utm_campaign, incoming.utm_campaign]),

      utm_content: preferIncomingForUtm
        ? firstNonEmpty([incoming.utm_content, previous.utm_content])
        : firstNonEmpty([previous.utm_content, incoming.utm_content]),

      utm_term: preferIncomingForUtm
        ? firstNonEmpty([incoming.utm_term, previous.utm_term])
        : firstNonEmpty([previous.utm_term, incoming.utm_term]),

      /*
        v4.4.3:
        Google click IDs must be selected as one coherent set.
        Do not mix fresh gclid/gbraid with stale wbraid from an older storage source.
      */
      gclid: selectedGoogleClickSet.gclid,
      gbraid: selectedGoogleClickSet.gbraid,
      wbraid: selectedGoogleClickSet.wbraid,
      google_click_id_source: selectedGoogleClickSet.source,
      google_click_id_guard_version: GOOGLE_CLICK_ID_GUARD_VERSION,

      fbclid: preferIncomingForClickId
        ? firstNonEmpty([incoming.fbclid, previous.fbclid])
        : firstNonEmpty([previous.fbclid, incoming.fbclid]),

      ttclid: preferIncomingForClickId
        ? firstNonEmpty([incoming.ttclid, previous.ttclid])
        : firstNonEmpty([previous.ttclid, incoming.ttclid]),

      landing: firstNonEmpty([incoming.landing, previous.landing, window.location.href]),
      referrer: firstNonEmpty([incoming.referrer, previous.referrer, document.referrer || '']),

      first_captured_at: firstNonEmpty([previous.first_captured_at, incoming.captured_at]),
      last_captured_at: firstNonEmpty([incoming.captured_at, previous.last_captured_at]),
      expires_at_ms: incoming.expires_at_ms || previous.expires_at_ms || '',
      snippet_version: VERSION
    };

    return merged;
  }
```

## Patch 2. 푸터 Block 1 UTM persistence v4.1

### 2-1. snippetVersion 교체

찾기:

```js
snippetVersion: '2026-05-14-biocom-footer-block1-click-id-v4-1'
```

교체:

```js
snippetVersion: '2026-05-21-biocom-footer-block1-click-id-v4-2',
googleClickIdGuardVersion: 'v4.4.3'
```

주의: 기존 object 마지막 property라면 쉼표 위치를 맞춘다. 아래처럼 되어야 한다.

```js
clickContextKey: '__biocom_click_id_context_v1',
snippetVersion: '2026-05-21-biocom-footer-block1-click-id-v4-2',
googleClickIdGuardVersion: 'v4.4.3'
```

### 2-2. helper 추가

위치: `function firstNonEmpty(values) { ... }` 바로 아래.

```js
  function googleClickSetFrom(source, sourceName) {
    source = source && typeof source === 'object' ? source : {};
    return {
      source: sourceName,
      gclid: trim(source.gclid),
      gbraid: trim(source.gbraid),
      wbraid: trim(source.wbraid)
    };
  }

  function hasGoogleClickSet(set) {
    return Boolean(set && (trim(set.gclid) || trim(set.gbraid) || trim(set.wbraid)));
  }

  function selectGoogleClickSet(candidates) {
    for (var i = 0; i < candidates.length; i += 1) {
      if (hasGoogleClickSet(candidates[i])) return candidates[i];
    }
    return googleClickSetFrom({}, 'none');
  }
```

### 2-3. `mergeTouch` 함수 전체 교체

기존 `function mergeTouch(previous, incoming, options) { ... }` 전체를 아래로 교체한다.

```js
  function mergeTouch(previous, incoming, options) {
    previous = previous && typeof previous === 'object' ? previous : {};
    incoming = incoming && typeof incoming === 'object' ? incoming : {};
    options = options || {};

    var preferIncomingUtm = options.preferIncomingUtm !== false;
    var preserveOriginalLanding = !!options.preserveOriginalLanding;
    var selectedGoogleClickSet = selectGoogleClickSet([
      googleClickSetFrom(incoming, 'incoming'),
      googleClickSetFrom(previous, 'previous')
    ]);

    return {
      utm_campaign: preferIncomingUtm
        ? firstNonEmpty([incoming.utm_campaign, previous.utm_campaign])
        : firstNonEmpty([previous.utm_campaign, incoming.utm_campaign]),

      utm_source: preferIncomingUtm
        ? firstNonEmpty([incoming.utm_source, previous.utm_source])
        : firstNonEmpty([previous.utm_source, incoming.utm_source]),

      utm_medium: preferIncomingUtm
        ? firstNonEmpty([incoming.utm_medium, previous.utm_medium])
        : firstNonEmpty([previous.utm_medium, incoming.utm_medium]),

      utm_content: preferIncomingUtm
        ? firstNonEmpty([incoming.utm_content, previous.utm_content])
        : firstNonEmpty([previous.utm_content, incoming.utm_content]),

      utm_term: preferIncomingUtm
        ? firstNonEmpty([incoming.utm_term, previous.utm_term])
        : firstNonEmpty([previous.utm_term, incoming.utm_term]),

      /*
        v4.4.3:
        Keep Google click IDs coherent. Do not mix gclid/gbraid/wbraid across sources.
      */
      gclid: selectedGoogleClickSet.gclid,
      gbraid: selectedGoogleClickSet.gbraid,
      wbraid: selectedGoogleClickSet.wbraid,
      google_click_id_source: selectedGoogleClickSet.source,
      google_click_id_guard_version: CONFIG.googleClickIdGuardVersion,

      fbclid: firstNonEmpty([incoming.fbclid, previous.fbclid]),
      ttclid: firstNonEmpty([incoming.ttclid, previous.ttclid]),

      fbc: firstNonEmpty([incoming.fbc, previous.fbc]),
      fbp: firstNonEmpty([incoming.fbp, previous.fbp]),

      landing: preserveOriginalLanding
        ? firstNonEmpty([previous.landing, incoming.landing, location.href])
        : firstNonEmpty([incoming.landing, previous.landing, location.href]),

      referrer: preserveOriginalLanding
        ? firstNonEmpty([previous.referrer, incoming.referrer, document.referrer || ''])
        : firstNonEmpty([incoming.referrer, previous.referrer, document.referrer || '']),

      user_id: firstNonEmpty([incoming.user_id, previous.user_id]),
      user_id_updated_at: incoming.user_id_updated_at || previous.user_id_updated_at || '',

      ts: incoming.ts || previous.ts || Date.now(),
      persisted_at: incoming.persisted_at || previous.persisted_at || new Date().toISOString(),

      click_context_version: firstNonEmpty([incoming.click_context_version, previous.click_context_version]),
      snippet_version: CONFIG.snippetVersion
    };
  }
```

## Patch 3. 푸터 Block 2 checkout_started / checkout_context v4.2

### 3-1. snippetVersion/debug prefix 교체

찾기:

```js
snippetVersion: '2026-05-14-biocom-checkout-started-click-id-v4-2',
```

교체:

```js
snippetVersion: '2026-05-21-biocom-checkout-started-click-id-v4-3',
googleClickIdGuardVersion: 'v4.4.3',
```

찾기:

```js
console.log.apply(console, ['[seo-checkout-started-v4.2]'].concat([].slice.call(arguments)));
```

교체:

```js
console.log.apply(console, ['[seo-checkout-started-v4.3]'].concat([].slice.call(arguments)));
```

### 3-2. helper 추가

위치: `function getSearchParam(keys) { ... }` 바로 아래.

```js
  function googleClickSetFrom(source, sourceName) {
    source = source && typeof source === 'object' ? source : {};
    return {
      source: sourceName,
      gclid: trim(source.gclid),
      gbraid: trim(source.gbraid),
      wbraid: trim(source.wbraid)
    };
  }

  function googleClickSetFromUrl(urlLike, sourceName) {
    try {
      if (!urlLike) return googleClickSetFrom({}, sourceName);
      var params = new URL(urlLike, location.origin).searchParams;
      return googleClickSetFrom({
        gclid: params.get('gclid'),
        gbraid: params.get('gbraid'),
        wbraid: params.get('wbraid')
      }, sourceName);
    } catch (error) {
      return googleClickSetFrom({}, sourceName);
    }
  }

  function hasGoogleClickSet(set) {
    return Boolean(set && (trim(set.gclid) || trim(set.gbraid) || trim(set.wbraid)));
  }

  function selectGoogleClickSet(candidates) {
    for (var i = 0; i < candidates.length; i += 1) {
      if (hasGoogleClickSet(candidates[i])) return candidates[i];
    }
    return googleClickSetFrom({}, 'none');
  }
```

### 3-3. `mergeLandingParams` 함수 전체 교체

기존 함수에서 Google click id 3종은 제거한다. 기존 `function mergeLandingParams(base, urlLike) { ... }` 전체를 아래로 교체한다.

```js
  function mergeLandingParams(base, urlLike) {
    try {
      if (!urlLike) return base;

      var params = new URL(urlLike, location.origin).searchParams;

      return {
        utm_source: firstNonEmpty([base.utm_source, params.get('utm_source')]),
        utm_medium: firstNonEmpty([base.utm_medium, params.get('utm_medium')]),
        utm_campaign: firstNonEmpty([base.utm_campaign, params.get('utm_campaign')]),
        utm_content: firstNonEmpty([base.utm_content, params.get('utm_content')]),
        utm_term: firstNonEmpty([base.utm_term, params.get('utm_term')]),

        /*
          v4.4.3:
          Google click IDs are selected atomically outside this generic landing merge.
        */
        gclid: base.gclid,
        gbraid: base.gbraid,
        wbraid: base.wbraid,

        fbclid: firstNonEmpty([base.fbclid, params.get('fbclid')]),
        ttclid: firstNonEmpty([base.ttclid, params.get('ttclid')]),

        fbc: firstNonEmpty([base.fbc, params.get('fbc')]),
        fbp: firstNonEmpty([base.fbp, params.get('fbp')])
      };
    } catch (error) {
      return base;
    }
  }
```

### 3-4. `tracking` 생성 전 selectedGoogleClickSet 추가

위치: `var initialReferrer = firstNonEmpty([...]);` 바로 아래에 붙여넣는다.

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

### 3-5. `tracking` 안의 Google click id 3종 교체

찾기:

```js
    /*
      Google click-id source priority:
      1) current URL query
      2) Header Bootstrap click context
      3) Footer Block 1 last touch
      4) Imweb session fallback
    */
    gclid: firstNonEmpty([
      getSearchParam(['gclid']),
      trim(clickContext.gclid),
      trim(lastTouch.gclid),
      trim(imwebSession.gclid)
    ]),
    gbraid: firstNonEmpty([
      getSearchParam(['gbraid']),
      trim(clickContext.gbraid),
      trim(lastTouch.gbraid),
      trim(imwebSession.gbraid)
    ]),
    wbraid: firstNonEmpty([
      getSearchParam(['wbraid']),
      trim(clickContext.wbraid),
      trim(lastTouch.wbraid),
      trim(imwebSession.wbraid)
    ]),
```

교체:

```js
    /*
      v4.4.3:
      Google click IDs are selected as one coherent set.
      Fresh gclid/gbraid must not inherit stale wbraid from older storage.
    */
    gclid: selectedGoogleClickSet.gclid,
    gbraid: selectedGoogleClickSet.gbraid,
    wbraid: selectedGoogleClickSet.wbraid,
```

### 3-6. metadata에 source/guard 추가

위치: `google_click_id_type: googleClickIdType,` 바로 아래.

```js
        google_click_id_source: selectedGoogleClickSet.source,
        google_click_id_guard_version: CONFIG.googleClickIdGuardVersion,
```

### 3-7. `__seo_checkout_context` 저장값에 source/guard 추가

위치: `googleClickIdType: googleClickIdType,` 바로 아래.

```js
      googleClickIdSource: selectedGoogleClickSet.source,
      googleClickIdGuardVersion: CONFIG.googleClickIdGuardVersion,
```

### 3-8. debug log에 source 추가

선택 사항이지만 권장한다. `debugLog('send payload presence', { ... })`와 duplicate skip log에 아래 값을 추가한다.

```js
google_click_id_source: selectedGoogleClickSet.source,
```

## Patch 4. 푸터 Block 3 payment_page_seen / payment_success v4.4.2

### 4-1. version 교체

찾기:

```js
snippetVersion: '2026-05-15-biocom-payment-split-v4-4-2',
pageSeenVersion: '2026-05-15-biocom-payment-page-seen-v4-4-2',
paymentSuccessVersion: '2026-05-15-biocom-payment-success-v4-4-2',
```

교체:

```js
snippetVersion: '2026-05-21-biocom-payment-split-v4-4-3',
pageSeenVersion: '2026-05-21-biocom-payment-page-seen-v4-4-3',
paymentSuccessVersion: '2026-05-21-biocom-payment-success-v4-4-3',
googleClickIdGuardVersion: 'v4.4.3',
```

찾기:

```js
console.log.apply(console, ['[seo-payment-split-v4.4.2]'].concat([].slice.call(arguments)));
```

교체:

```js
console.log.apply(console, ['[seo-payment-split-v4.4.3]'].concat([].slice.call(arguments)));
```

dedupe prefix는 그대로 둔다.

```js
paymentPageSeenDedupePrefix: '__seo_payment_page_seen_sent_v4_4_2__:',
paymentPageExitDedupePrefix: '__seo_payment_page_seen_exit_sent_v4_4_2__:',
paymentSuccessDedupePrefix: '__seo_payment_success_sent_v4_4_2__:',
```

이유: version만 올리고 dedupe prefix까지 바꾸면 기존 주문완료 페이지 재방문 시 중복 row가 생길 수 있다.

### 4-2. helper 추가

위치: `function getSearchParam(keys) { ... }` 바로 아래.

```js
  function googleClickSetFrom(source, sourceName) {
    source = source && typeof source === 'object' ? source : {};
    return {
      source: sourceName,
      gclid: trim(source.gclid),
      gbraid: trim(source.gbraid),
      wbraid: trim(source.wbraid)
    };
  }

  function googleClickSetFromUrl(urlLike, sourceName) {
    try {
      if (!urlLike) return googleClickSetFrom({}, sourceName);
      var params = new URL(urlLike, location.origin).searchParams;
      return googleClickSetFrom({
        gclid: params.get('gclid'),
        gbraid: params.get('gbraid'),
        wbraid: params.get('wbraid')
      }, sourceName);
    } catch (error) {
      return googleClickSetFrom({}, sourceName);
    }
  }

  function hasGoogleClickSet(set) {
    return Boolean(set && (trim(set.gclid) || trim(set.gbraid) || trim(set.wbraid)));
  }

  function selectGoogleClickSet(candidates) {
    for (var i = 0; i < candidates.length; i += 1) {
      if (hasGoogleClickSet(candidates[i])) return candidates[i];
    }
    return googleClickSetFrom({}, 'none');
  }
```

### 4-3. `mergeLandingParams` 함수 전체 교체

```js
  function mergeLandingParams(base, urlLike) {
    try {
      if (!urlLike) return base;

      var params = new URL(urlLike, location.origin).searchParams;

      return {
        utm_source: firstNonEmpty([base.utm_source, params.get('utm_source')]),
        utm_medium: firstNonEmpty([base.utm_medium, params.get('utm_medium')]),
        utm_campaign: firstNonEmpty([base.utm_campaign, params.get('utm_campaign')]),
        utm_content: firstNonEmpty([base.utm_content, params.get('utm_content')]),
        utm_term: firstNonEmpty([base.utm_term, params.get('utm_term')]),

        /*
          v4.4.3:
          Google click IDs are selected atomically in buildCommonContext.
        */
        gclid: base.gclid,
        gbraid: base.gbraid,
        wbraid: base.wbraid,

        fbclid: firstNonEmpty([base.fbclid, params.get('fbclid')]),
        ttclid: firstNonEmpty([base.ttclid, params.get('ttclid')]),

        fbc: firstNonEmpty([base.fbc, params.get('fbc')]),
        fbp: firstNonEmpty([base.fbp, params.get('fbp')])
      };
    } catch (error) {
      return base;
    }
  }
```

### 4-4. `buildCommonContext` 함수 전체 교체

기존 `function buildCommonContext() { ... }` 전체를 아래로 교체한다.

```js
  function buildCommonContext() {
    var imwebSession = readJsonStorage(window.sessionStorage, '__bs_imweb_session');
    var lastTouch = readJsonStorage(window.localStorage, '_p1s1a_last_touch');
    var clickContext = readJsonStorage(window.localStorage, CONFIG.clickContextKey);
    var checkoutContext = readJsonStorage(window.sessionStorage, CONFIG.checkoutContextKey);

    var checkoutId = firstNonEmpty([
      trim(checkoutContext.checkoutId),
      trim(window.sessionStorage && window.sessionStorage.getItem(CONFIG.checkoutIdKey)),
      getOrCreateCheckoutId()
    ]);

    var landing = location.href;

    var versionedCheckoutContext = trim(checkoutContext.googleClickIdGuardVersion) === CONFIG.googleClickIdGuardVersion
      ? checkoutContext
      : {};

    var legacyCheckoutContext = trim(checkoutContext.googleClickIdGuardVersion) === CONFIG.googleClickIdGuardVersion
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

    var tracking = mergeLandingParams({
      utm_source: firstNonEmpty([
        getSearchParam(['utm_source']),
        trim(checkoutContext.utm_source),
        trim(clickContext.utm_source),
        trim(lastTouch.utm_source),
        trim(imwebSession.utmSource)
      ]),
      utm_medium: firstNonEmpty([
        getSearchParam(['utm_medium']),
        trim(checkoutContext.utm_medium),
        trim(clickContext.utm_medium),
        trim(lastTouch.utm_medium),
        trim(imwebSession.utmMedium)
      ]),
      utm_campaign: firstNonEmpty([
        getSearchParam(['utm_campaign']),
        trim(checkoutContext.utm_campaign),
        trim(clickContext.utm_campaign),
        trim(lastTouch.utm_campaign),
        trim(imwebSession.utmCampaign)
      ]),
      utm_content: firstNonEmpty([
        getSearchParam(['utm_content']),
        trim(checkoutContext.utm_content),
        trim(clickContext.utm_content),
        trim(lastTouch.utm_content),
        trim(imwebSession.utmContent)
      ]),
      utm_term: firstNonEmpty([
        getSearchParam(['utm_term']),
        trim(checkoutContext.utm_term),
        trim(clickContext.utm_term),
        trim(lastTouch.utm_term),
        trim(imwebSession.utmTerm)
      ]),

      /*
        v4.4.3:
        One coherent Google click-id source only.
      */
      gclid: selectedGoogleClickSet.gclid,
      gbraid: selectedGoogleClickSet.gbraid,
      wbraid: selectedGoogleClickSet.wbraid,

      fbclid: firstNonEmpty([
        getSearchParam(['fbclid']),
        trim(checkoutContext.fbclid),
        trim(clickContext.fbclid),
        trim(lastTouch.fbclid),
        trim(imwebSession.fbclid)
      ]),
      ttclid: firstNonEmpty([
        getSearchParam(['ttclid']),
        trim(checkoutContext.ttclid),
        trim(lastTouch.ttclid),
        trim(imwebSession.ttclid)
      ]),

      fbc: firstNonEmpty([
        trim(lastTouch.fbc),
        readCookie('_fbc'),
        getSearchParam(['fbc'])
      ]),
      fbp: firstNonEmpty([
        trim(lastTouch.fbp),
        readCookie('_fbp'),
        getSearchParam(['fbp'])
      ])
    }, landing);

    return {
      imwebSession: imwebSession,
      lastTouch: lastTouch,
      clickContext: clickContext,
      checkoutContext: checkoutContext,
      checkoutId: checkoutId,
      landing: landing,
      tracking: tracking,
      googleClickIdSource: selectedGoogleClickSet.source,
      googleClickIdGuardVersion: CONFIG.googleClickIdGuardVersion
    };
  }
```

### 4-5. `payment_page_seen` metadata에 source/guard 추가

위치: `google_click_id_type: googleClickIdType,` 바로 아래.

```js
        google_click_id_source: context.googleClickIdSource,
        google_click_id_guard_version: context.googleClickIdGuardVersion,
```

### 4-6. `payment_success` metadata에 source/guard 추가 및 restore source 교체

위치: `google_click_id_type: googleClickIdType,` 바로 아래.

```js
        google_click_id_source: context.googleClickIdSource,
        google_click_id_guard_version: context.googleClickIdGuardVersion,
```

찾기:

```js
        click_id_restore_source: trim(getSearchParam(['gclid']))
          ? 'url_query'
          : (trim(context.checkoutContext.gclid)
            ? 'checkout_context'
            : (trim(context.clickContext.gclid)
              ? 'header_click_context'
              : (trim(context.lastTouch.gclid) ? 'last_touch' : 'none'))),
```

교체:

```js
        click_id_restore_source: context.googleClickIdSource,
```

### 4-7. `paymentSuccessContextKey` 저장값에 source/guard 추가

위치: `clickIdRestoreSource: payload.metadata.click_id_restore_source,` 바로 아래.

```js
      googleClickIdSource: context.googleClickIdSource,
      googleClickIdGuardVersion: context.googleClickIdGuardVersion,
```

### 4-8. debug log에 source 추가

`debugLog('send payment_success presence', { ... })`에 아래를 추가한다.

```js
      google_click_id_source: context.googleClickIdSource,
```

## 적용 후 smoke 체크리스트

아임웹 반영 직후에는 실제 결제 전송을 하지 말고 먼저 HTML marker만 확인한다.

1. 운영 HTML에서 아래 version marker 4개가 보여야 한다.
   - `2026-05-21-biocom-click-id-bootstrap-v1-1`
   - `2026-05-21-biocom-footer-block1-click-id-v4-2`
   - `2026-05-21-biocom-checkout-started-click-id-v4-3`
   - `2026-05-21-biocom-payment-split-v4-4-3`
2. `?__seo_attribution_debug=1`로 접속했을 때 console log prefix가 v4.3/v4.4.3으로 보여야 한다.
3. Google 광고 클릭 후 가상계좌 미입금 주문 1건을 만들고, VM Cloud read-only로 확인한다.
4. 클릭 URL에 `wbraid`가 없으면 `payment_success.metadata.wbraid`도 없어야 한다.
5. 클릭 URL에 있던 `gclid/gbraid/gad_campaignid` 연결 evidence는 유지되어야 한다.

## rollback

문제가 보이면 아임웹 헤더/푸터 custom code를 백업본으로 되돌린다.

되돌릴 때 확인할 것:

1. v4.4.3 marker 4개가 운영 HTML에서 사라졌는가.
2. v4.4.2 marker가 다시 보이는가.
3. payment-decision guard, GTM loader, Meta/TikTok 관련 블록은 백업 전후 동일한가.

## 검증

로컬 fixture:

```bash
node scripts/imweb-v443-click-id-fixture.mjs
```

기대 결과:

```text
7/7 fixture cases passed
```

현재 결과: PASS.

## 다음 할일

1. TJ님이 이 패치본을 확인한다.
무엇을/왜: 실제 아임웹에서 어떤 코드 조각을 바꾸는지 확인한다.
어떻게/어디서: 이 문서의 Patch 1~4만 본다. payment-decision guard/GTM/Meta/TikTok 블록은 이번 수정 대상이 아니다.
누가: TJ님.
성공 기준: 수정 대상이 헤더 1개 + 푸터 3개로 이해된다.
실패 시 확인점: 전체 코드 통째 교체가 필요한지, 아니면 찾기/교체 방식으로 충분한지 결정한다.
승인 필요 여부: 확인만은 NO, 운영 반영은 YES.
의존성: 없음.
추천 점수/자신감: 88%.

2. TJ님이 운영 반영을 승인한다.
무엇을/왜: 실제 아임웹 결제 흐름에서 stale `wbraid` 혼입을 막는다.
어떻게/어디서: 이 대화에 `Imweb v4.4.3 운영 반영 승인`이라고 답하면 된다.
누가: TJ님 승인, Codex 반영 지원.
성공 기준: 운영 HTML marker 확인 + 새 테스트 주문에서 stale `wbraid` 미검출.
실패 시 확인점: 아임웹 캐시, storage stale 상태, header/footer 중복 설치.
승인 필요 여부: YES, Red Lane.
의존성: Patch 1~4 확인 후 진행.
추천 점수/자신감: 90%.
