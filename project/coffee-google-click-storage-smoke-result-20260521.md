# 더클린커피 Google 클릭 저장 Smoke 결과

작성 시각: 2026-05-21 23:22 KST
기준일: 2026-05-21
문서 성격: 더클린커피 live landing/cart 브라우저 저장소 no-send smoke 결과
Lane: Green read-only / no-send browser storage smoke
정본 연결: `imweb/!coderule-thecleancoffee.md`, `GA4/gtm-thecleancoffee.md`, `data/!coffeedata.md`

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
    - GA4/gtm-thecleancoffee.md
    - data/!coffeedata.md
  lane: Green
  allowed_actions:
    - Playwright browser-storage smoke
    - live page read-only navigation
    - tracking endpoint route block
    - result documentation
  forbidden_actions:
    - Imweb save/publish
    - GTM Production publish
    - Google Ads conversion action mutate
    - Google Ads conversion upload
    - actual checkout or purchase
    - production DB or VM Cloud SQLite write
  source_window_freshness_confidence:
    source: thecleancoffee.com live pages + browser local/session storage
    window: 2026-05-21 23:17-23:18 KST
    freshness: live page smoke at report time
    confidence: 0.88
```

## 10초 요약

더클린커피 현재 live 코드에서 `gclid`는 landing 후 `shop_cart`까지 구조화 필드로 보존된다. 그러나 `gbraid`, `wbraid`, `gad_campaignid`는 full landing URL 문자열에는 남지만 `_p1s1a_*` storage의 구조화 필드로는 저장되지 않는다.

따라서 Google Ads 클릭 저장 smoke의 1차 결론은 `gclid path PASS`, `gbraid/wbraid/gad_campaignid structured field GAP`이다.

## 실행 방식

Playwright로 live landing page와 `shop_cart`를 열었다. 외부 tracking/platform endpoint는 route에서 차단해 no-send 성격을 유지했다.

차단한 대표 host:

- `www.googletagmanager.com`
- `connect.facebook.net`
- `wcs.naver.net`
- `rum.beusable.net`
- `storage.keepgrow.com`
- `att.ainativeos.net`
- `google-analytics.com`
- `googleadservices.com`
- `doubleclick.net`

방문하지 않은 경로:

- checkout
- payment
- payment complete
- purchase

실행하지 않은 작업:

- Imweb 저장
- GTM publish
- Google Ads mutate/upload
- Meta/GA4/Google Ads production send toggle
- DB/VM Cloud write

## 케이스 결과

### 1. `gclid` landing only

- test URL: `https://thecleancoffee.com/?utm_source=google&utm_medium=cpc&utm_campaign=codex_click_storage_smoke_gclid_20260521_2312&gclid=TEST_GCLID_COFFEE_20260521_2312&gad_campaignid=14629255429`
- status: 200
- `_p1s1a_last_touch.gclid`: present
- `sessionStorage._p1s1a_session_touch.gclid`: present
- landing URL string has `gclid`: yes
- landing URL string has `gad_campaignid`: yes
- structured `gad_campaignid`: absent

판정: PASS with note. `gclid`는 구조화 필드로 저장된다.

### 2. `gbraid` landing only

- test URL: `https://thecleancoffee.com/?utm_source=google&utm_medium=cpc&utm_campaign=codex_click_storage_smoke_gbraid_20260521_2312&gbraid=TEST_GBRAID_COFFEE_20260521_2312&gad_campaignid=14629255429`
- status: 200
- `_p1s1a_last_touch.gbraid`: absent
- `sessionStorage._p1s1a_session_touch.gbraid`: absent
- landing URL string has `gbraid`: yes
- landing URL string has `gad_campaignid`: yes
- structured `gad_campaignid`: absent

판정: GAP. `gbraid`가 URL 문자열에는 남지만 구조화 필드로 저장되지 않는다.

### 3. `wbraid` landing only

- test URL: `https://thecleancoffee.com/?utm_source=google&utm_medium=cpc&utm_campaign=codex_click_storage_smoke_wbraid_20260521_2312&wbraid=TEST_WBRAID_COFFEE_20260521_2312&gad_campaignid=14629255429`
- status: 200
- `_p1s1a_last_touch.wbraid`: absent
- `sessionStorage._p1s1a_session_touch.wbraid`: absent
- landing URL string has `wbraid`: yes
- landing URL string has `gad_campaignid`: yes
- structured `gad_campaignid`: absent

판정: GAP. `wbraid`가 URL 문자열에는 남지만 구조화 필드로 저장되지 않는다.

### 4. landing -> `shop_cart`

같은 browser context에서 landing 후 `https://thecleancoffee.com/shop_cart`로 이동했다.

- `gclid_to_cart`: `gclid` structured field preserved in local/session storage.
- `gbraid_to_cart`: `gbraid` structured field absent after cart.
- `wbraid_to_cart`: `wbraid` structured field absent after cart.
- `gad_campaignid`: 모든 케이스에서 structured field absent.
- `shop_cart` URL condition: `location.href.endsWith('shop_cart') === true`

판정: `gclid`는 장바구니까지 보존된다. `gbraid/wbraid/gad_campaignid`는 장바구니까지도 구조화 필드로 보존되지 않는다.

## 해석

현재 더클린커피 footer/header storage 계층은 `gclid/fbclid/ttclid` 중심이다. iOS/앱/일부 Google Ads 클릭에서 들어올 수 있는 `gbraid`와 `wbraid`는 full URL string 안에는 남지만, checkout-context/payment-success payload가 직접 읽는 구조화 필드에는 없다.

따라서 Google Ads confirmed ROAS 관점에서는 다음 문제가 남는다.

1. `gclid` 유입은 같은 브라우저에서 주문 흐름까지 이어질 가능성이 있다.
2. `gbraid/wbraid` 유입은 현재 구조화 필드 기준으로 결제 evidence까지 이어지지 않을 가능성이 있다.
3. `gad_campaignid`는 캠페인 ID 힌트일 뿐 클릭 ID가 아니며, 지금은 구조화 필드로도 저장되지 않는다.

## 한계

이번 smoke는 no-send 원칙을 지키기 위해 tracking endpoint를 차단했다. 따라서 GTM Conversion Linker가 Google cookie를 실제로 세팅하는지, Google Ads/GA4가 page_view를 받는지는 확인하지 않았다.

checkout/payment/payment_complete 경로도 방문하지 않았다. 실제 결제 단계 payload 확인은 별도 smoke가 필요하며, 실제 결제는 Red Lane이다.

## 다음 판단

1. `gclid` 저장은 1차 PASS로 보고, 다음 Meta Pixel browser eventId smoke를 진행한다.
2. `gbraid/wbraid/gad_campaignid` 구조화 저장 gap은 add_payment_info GTM Preview 설계 전에 보강 후보로 둔다.
3. Imweb footer 수정이나 GTM publish는 아직 하지 않는다.
