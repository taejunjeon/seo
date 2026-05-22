# 더클린커피 Google 클릭 ID 구조화 저장 보강안

작성 시각: 2026-05-21 23:24 KST
기준일: 2026-05-21
문서 성격: Green Lane 보강안 / Imweb 운영 반영 전 설계안
정본 연결: `imweb/!coderule-thecleancoffee.md`, `project/coffee-google-click-storage-smoke-result-20260521.md`, `imweb/!coderule.md`

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
    - imweb/!coderule-thecleancoffee.md
    - project/coffee-google-click-storage-smoke-result-20260521.md
    - imweb/!coderule.md
    - project/imweb-header-top-full-v313-virtual-account-issued-20260521.md
    - project/imweb-footer-full-v445-block4-value-retry-20260521.md
    - scripts/imweb-v443-click-id-fixture.mjs
  lane: Green
  allowed_actions:
    - document
    - local_design
    - no_send_fixture_plan
    - approval_packet_draft
  forbidden_actions:
    - Imweb save/publish
    - GTM Production publish
    - Google Ads conversion action mutate
    - Google Ads conversion upload
    - GA4/Meta/Google Ads production send toggle
    - actual checkout or purchase
    - production DB or VM Cloud SQLite write
  source_window_freshness_confidence:
    source: Coffee live storage smoke + Biocom v4.4.3/v4.4.5 local docs
    window: Coffee smoke 2026-05-21 23:17-23:18 KST; Biocom reference 2026-05-21
    freshness: same-day live smoke and same-day Biocom docs
    confidence: 0.89
```

## 10초 요약

더클린커피는 현재 `gclid`만 구조화 필드로 저장한다. `gbraid`, `wbraid`, `gad_campaignid`는 landing URL 문자열 안에는 남지만, checkout/payment payload가 직접 쓰기 쉬운 필드로는 저장되지 않는다.

보강 방향은 바이오컴 v4.4.3의 원칙을 Coffee에 맞게 이식하는 것이다. 핵심은 `gclid`, `gbraid`, `wbraid`를 각각 따로 섞지 않고, 한 출처에서 온 Google 클릭 ID 묶음을 통째로 선택하는 것이다. `gad_campaignid`는 캠페인 힌트로 함께 보존하지만, 클릭 ID처럼 업로드 자격을 만들지는 않는다.

이 문서는 운영 반영 전 설계안이다. Imweb 저장, GTM publish, 광고 플랫폼 전송은 하지 않았다.

## 현재 확인된 gap

2026-05-21 23:17-23:18 KST live no-send smoke 결과:

- `gclid`: `_p1s1a_last_touch`와 `sessionStorage._p1s1a_session_touch` 구조화 필드에 저장되고 `/shop_cart`까지 보존된다.
- `gbraid`: full landing URL 문자열에는 남지만 구조화 필드에는 없다.
- `wbraid`: full landing URL 문자열에는 남지만 구조화 필드에는 없다.
- `gad_campaignid`: full landing URL 문자열에는 남지만 구조화 필드에는 없다.

의미:

1. 일반 `gclid` 클릭은 같은 브라우저 주문 흐름까지 이어질 가능성이 있다.
2. iOS/앱 계열 Google 클릭에서 들어오는 `gbraid/wbraid`는 결제 evidence payload에서 빠질 가능성이 있다.
3. `gad_campaignid`는 캠페인 ID 힌트라 ROAS 캠페인 조인에는 유용하지만, `gclid/gbraid/wbraid` 같은 클릭 ID가 아니므로 단독 업로드 후보가 되면 안 된다.

## 바이오컴 참고 기준

바이오컴은 2026-05-21 기준 다음 구조를 쓴다.

- 헤더 상단 marker: `2026-05-21-biocom-click-id-bootstrap-v1-1`
- 푸터 Block 1 marker: `2026-05-21-biocom-footer-block1-click-id-v4-2`
- checkout marker: `2026-05-21-biocom-checkout-started-click-id-v4-3`
- payment marker: `2026-05-21-biocom-payment-split-v4-4-3`
- Google click guard version: `v4.4.3`
- 주요 저장 key: `__biocom_click_id_context_v1`, `__biocom_click_ids`, `_p1s1a_first_touch`, `_p1s1a_last_touch`, `_p1s1a_session_touch`

바이오컴 v4.4.3의 원칙:

1. `gclid/gbraid/wbraid`를 독립 fallback하지 않는다.
2. 현재 URL, referrer, click context, last touch, Imweb session 같은 후보를 순서대로 본다.
3. Google click id가 하나라도 있는 첫 후보 출처를 선택한다.
4. 선택된 출처의 `gclid/gbraid/wbraid` 묶음만 payload에 넣는다.
5. 새 `gclid+gbraid`에 과거 저장소의 stale `wbraid`를 붙이지 않는다.
6. 실제 `wbraid` only 클릭은 버리지 않고 유지한다.

바이오컴 fixture 결과:

- `scripts/imweb-v443-click-id-fixture.mjs` 7/7 PASS
- stale `wbraid` 제거 PASS
- actual `wbraid` only 보존 PASS
- `fbclid/ttclid` fallback 영향 없음 PASS

Coffee에 가져올 것은 이 구조화 저장 원칙이다. Biocom key, pixel id, endpoint, site/store 값은 Coffee에 복사하지 않는다.

## Coffee 보강 목표

### 목표 1. 구조화 필드 추가

아래 필드가 `_p1s1a_last_touch`, `_p1s1a_session_touch`, checkout-context, payment-success payload에 같은 규칙으로 들어가야 한다.

- `gclid`
- `gbraid`
- `wbraid`
- `gad_source`
- `gad_campaignid`
- `google_click_id_source`
- `google_click_id_guard_version`

### 목표 2. stale 혼입 방지

새 URL에 `gclid+gbraid`가 있고 과거 저장소에 `wbraid`가 있을 때, 최종 payload는 다음이어야 한다.

```json
{
  "gclid": "fresh_gclid",
  "gbraid": "fresh_gbraid",
  "wbraid": "",
  "google_click_id_source": "current_url"
}
```

### 목표 3. actual `wbraid` only 보존

새 URL 또는 referrer가 `wbraid`만 가진 실제 Google 클릭이면 다음처럼 유지해야 한다.

```json
{
  "gclid": "",
  "gbraid": "",
  "wbraid": "actual_wbraid",
  "google_click_id_source": "current_url"
}
```

### 목표 4. `gad_campaignid`는 힌트로만 보존

`gad_campaignid`는 캠페인 ID 힌트다. 단독으로 Google 클릭 ID가 아니다.

따라서 `gad_campaignid`만 있고 `gclid/gbraid/wbraid`가 없으면:

- 저장은 가능하다.
- `has_google_click_id`는 false다.
- Google Ads conversion upload 후보가 되면 안 된다.
- 내부 ROAS 캠페인 힌트 confidence도 낮게 둔다.

## 권장 구현 설계

### 1. Coffee 전용 key와 version

Biocom key와 섞이지 않도록 Coffee 전용 key를 쓴다.

```js
var COFFEE_GOOGLE_CLICK_GUARD_VERSION = 'coffee-google-click-id-v1';
var COFFEE_CLICK_CONTEXT_KEY = '__thecleancoffee_click_id_context_v1';
var COFFEE_CLICK_COOKIE_KEY = '__thecleancoffee_click_ids';
```

1차 보강은 cookie 없이 local/session storage만으로도 가능하다. 다만 결제 페이지에서 storage 접근이 불안정하면 cookie fallback을 v2 후보로 둔다.

### 2. 공통 helper

헤더 상단의 간단 UTM persistence, footer Block 1, checkout-context, payment-success에 같은 개념을 쓴다.

```js
function googleClickSetFrom(source, sourceName) {
  return {
    source: sourceName,
    gclid: trim(source && source.gclid),
    gbraid: trim(source && source.gbraid),
    wbraid: trim(source && source.wbraid),
    gad_source: trim(source && source.gad_source),
    gad_campaignid: trim(source && source.gad_campaignid)
  };
}

function googleClickSetFromUrl(urlLike, sourceName) {
  try {
    var url = new URL(urlLike || '', location.origin);
    return googleClickSetFrom({
      gclid: url.searchParams.get('gclid'),
      gbraid: url.searchParams.get('gbraid'),
      wbraid: url.searchParams.get('wbraid'),
      gad_source: url.searchParams.get('gad_source'),
      gad_campaignid: url.searchParams.get('gad_campaignid')
    }, sourceName);
  } catch (error) {
    return googleClickSetFrom({}, sourceName);
  }
}

function hasGoogleClickId(set) {
  return Boolean(set && (set.gclid || set.gbraid || set.wbraid));
}

function selectGoogleClickSet(candidates) {
  for (var i = 0; i < candidates.length; i += 1) {
    if (hasGoogleClickId(candidates[i])) return candidates[i];
  }
  return googleClickSetFrom({}, 'none');
}

function googleCampaignHintFrom(candidates) {
  for (var i = 0; i < candidates.length; i += 1) {
    if (candidates[i] && (candidates[i].gad_campaignid || candidates[i].gad_source)) {
      return {
        gad_source: candidates[i].gad_source || '',
        gad_campaignid: candidates[i].gad_campaignid || '',
        source: candidates[i].source || ''
      };
    }
  }
  return { gad_source: '', gad_campaignid: '', source: '' };
}
```

`selectGoogleClickSet`은 `gad_campaignid`만으로 후보를 선택하지 않는다. 이 점이 중요하다.

### 3. 헤더 상단 UTM persistence 보강

현재 Coffee 헤더 상단의 간단 UTM persistence는 `gclid/fbclid/ttclid` 중심이다. 여기에 `gbraid/wbraid/gad_source/gad_campaignid`를 추가한다.

보강 후 저장해야 할 값:

```js
{
  gclid: selectedGoogleClickSet.gclid,
  gbraid: selectedGoogleClickSet.gbraid,
  wbraid: selectedGoogleClickSet.wbraid,
  gad_source: campaignHint.gad_source,
  gad_campaignid: campaignHint.gad_campaignid,
  google_click_id_source: selectedGoogleClickSet.source,
  google_click_id_guard_version: COFFEE_GOOGLE_CLICK_GUARD_VERSION
}
```

`hasMarketingSignal`에는 `gbraid`, `wbraid`, `gad_source`, `gad_campaignid`도 포함한다.

### 4. Footer Block 1 보강

현재 Block 1의 `collectTrackingParams()`에 아래 필드를 추가한다.

- `gbraid`
- `wbraid`
- `gad_source`
- `gad_campaignid`

기존 `_p1s1a_*` touch를 업데이트할 때는 Google click id 3종을 각각 병합하지 않는다. `selectedGoogleClickSet`을 먼저 만들고 그 묶음만 저장한다.

권장 후보 순서:

1. current URL
2. previous last touch
3. previous first touch
4. Imweb session

### 5. Footer Block 2 checkout-context 보강

checkout-context는 결제 시작 후보를 VM Cloud로 남기는 경로다. 실제 구매 전송이 아니다.

권장 후보 순서:

1. current URL
2. document referrer
3. Coffee click context
4. last touch
5. Imweb session

payload와 metadata에 추가:

```js
gclid: selectedGoogleClickSet.gclid,
gbraid: selectedGoogleClickSet.gbraid,
wbraid: selectedGoogleClickSet.wbraid,
gad_source: campaignHint.gad_source,
gad_campaignid: campaignHint.gad_campaignid,
metadata: {
  google_click_id_source: selectedGoogleClickSet.source,
  google_click_id_guard_version: COFFEE_GOOGLE_CLICK_GUARD_VERSION,
  has_gclid: Boolean(selectedGoogleClickSet.gclid),
  has_gbraid: Boolean(selectedGoogleClickSet.gbraid),
  has_wbraid: Boolean(selectedGoogleClickSet.wbraid),
  gad_campaignid_source: campaignHint.source
}
```

### 6. Footer Block 3 payment-success 보강

payment-success는 결제완료 evidence 수집이다. Google Ads 전환 업로드가 아니다.

권장 후보 순서:

1. current URL
2. versioned checkout context
3. document referrer
4. Coffee click context
5. last touch
6. Imweb session
7. legacy checkout context

`checkoutContext.google_click_id_guard_version` 또는 `checkoutContext.googleClickIdGuardVersion`이 `coffee-google-click-id-v1`이면 versioned context로 본다.

payload와 metadata에는 Block 2와 같은 필드를 넣는다.

### 7. dedupe key 유지

이번 보강은 event를 더 많이 보내는 것이 아니다. 같은 주문의 click evidence를 더 정확히 남기는 변경이다.

따라서 payment-success dedupe key prefix는 보수적으로 유지한다. dedupe prefix를 바꾸면 과거 주문완료 페이지 재방문 때 중복 수집이 생길 수 있다.

## 로컬 fixture 테스트 계획

Coffee 전용 fixture를 만들면 아래 케이스를 반드시 통과해야 한다.

1. `current_url`에 `gclid+gbraid+gad_campaignid`, 이전 저장소에 stale `wbraid`가 있으면 `wbraid`는 비어야 한다.
2. `current_url`에 `wbraid`만 있으면 `wbraid`는 보존되어야 한다.
3. `gad_campaignid`만 있으면 구조화 저장은 하되 `has_google_click_id=false`여야 한다.
4. landing 후 `/shop_cart`로 이동해도 `gclid/gbraid/wbraid/gad_campaignid` 구조화 필드가 유지되어야 한다.
5. checkout-context가 versioned context면 payment-success가 더 오래된 last touch로 fallback하지 않아야 한다.
6. `fbclid/ttclid` 저장은 기존과 동일하게 유지되어야 한다.
7. Purchase Guard, Funnel CAPI mirror, Google Ads 장바구니 삭제 label 호출에는 영향이 없어야 한다.

2026-05-21 실행 결과:

- script: `scripts/coffee-click-id-structured-storage-fixture.mjs`
- result: 9/9 PASS
- 상세 문서: `project/coffee-click-id-structured-storage-fixture-result-20260521.md`
- 핵심 판정: `gad_campaignid` only 케이스는 campaign hint로만 저장되고 `has_google_click_id=false`로 남는다. fresh `gclid+gbraid`는 stale `wbraid`를 끌어오지 않는다.

## 운영 반영 전 승인안 초안

승인 요청 이름: 더클린커피 Google click-id 구조화 저장 Imweb custom code 반영.

내가 실제로 바꾸는 화면:

- 더클린커피 Imweb 관리자
- 환경설정 또는 사이트 설정의 custom code 입력 영역
- 헤더 코드 상단과 푸터 코드

바꾸는 설정 이름:

- `_p1s1a_*` touch 저장 필드
- checkout-context payload
- payment-success payload
- Google click id guard version marker

바꾸면 생기는 효과:

- `gclid`뿐 아니라 `gbraid/wbraid`도 주문 흐름 evidence로 이어질 수 있다.
- `gad_campaignid`가 campaign hint로 남아 Google Ads 캠페인별 ROAS 확인에 도움을 준다.
- 새 Google 클릭에 과거 stale `wbraid`가 섞일 가능성을 줄인다.

안 바꾸면 남는 문제:

- iOS/앱 계열 Google 클릭은 full URL 문자열에는 있어도 payload 구조화 필드에서 빠질 수 있다.
- 향후 confirmed purchase no-send 후보에서 `missing_google_click_id`가 계속 높게 남을 수 있다.
- 캠페인 ID 조인은 landing URL 문자열 파싱에 의존하게 된다.

Codex가 대신 못 하는 이유:

Imweb custom code 저장은 라이브 사이트 전체 tracking/결제 evidence에 영향을 준다. Red Lane이므로 TJ님 명시 승인 전 운영 반영하지 않는다.

## 현재 권장 순서

1. Coffee 전용 로컬 fixture 작성과 실행.
2. Meta Pixel browser eventId smoke.
3. Coffee full paste 후보 작성.
4. TJ님 승인 후 Imweb 저장.
5. live no-send storage smoke 재실행.
6. 결제 단계 smoke는 실제 결제 없이 가능한 화면 범위부터 확인.

## 하지 않은 것

- Imweb 저장 0건
- GTM publish 0건
- Google Ads conversion upload 0건
- Meta/GA4/Google Ads production send toggle 0건
- 실제 checkout/purchase 0건
- 운영DB/VM Cloud write 0건
