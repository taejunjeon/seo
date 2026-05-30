---
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
    - imweb/code_coffee_260527.md
    - report/reportcoffee-attribution-preservation-map-20260527.md
  lane: Green
  allowed_actions:
    - smoke plan
    - read-only VM Cloud query after user test
    - no-send/no-write fixture
  forbidden_actions:
    - Google Ads conversion upload
    - Google Ads campaign/ad/budget edit
    - GTM publish
    - Imweb save/publish
    - production DB write
  source_window_freshness_confidence:
    source: "Coffee live smoke + imweb/code_coffee_260527.md"
    window: "2026-05-27 KST"
    freshness: "same-day"
    confidence: 0.9
---

# 더클린커피 Google Ads 클릭 ID smoke 계획

작성 시각: 2026-05-27 KST
문서 성격: 실제 Google Ads 변경 없는 브라우저 저장/원장 보존 smoke 계획

## 10초 요약

네이버 브랜드검색은 `payment_success`까지 보존이 확인됐다.
다음은 Google Ads synthetic URL로 `gclid/gbraid/gad_campaignid`가 landing → 주문서 → 가상계좌 미입금 완료 → VM Cloud `payment_success`까지 남는지 확인한다.

이 smoke는 Google Ads upload 가능한 click id 검증이 아니다. 저장/복원 경로 검증이다.

## 테스트 URL

```text
https://thecleancoffee.com/?utm_source=google&utm_medium=cpc&utm_campaign=coffee_google_smoke_0527&gclid=TJ_GCLID_0527&gbraid=TJ_GBRAID_0527&gad_campaignid=14629255429&gad_source=1&__seo_attribution_debug=1
```

## TJ님 브라우저 절차

1. 가능하면 새 시크릿 창을 연다.
2. 위 URL로 접속한다.
3. 상품 상세로 이동한다.
4. 구매하기를 눌러 `/shop_payment/` 주문서에 진입한다.
5. 주문서에서 아래 콘솔을 실행한다.
6. 가상계좌 미입금 주문을 생성한다.
7. `/shop_payment_complete` 결제완료 화면에서 같은 콘솔을 다시 실행한다.

## 콘솔 스크립트

raw click id 값은 출력하지 않고 존재 여부와 source만 출력한다.

```js
(() => {
  const read = (s, k) => {
    try { return JSON.parse(s.getItem(k) || '{}'); } catch { return {}; }
  };
  const pick = (o) => ({
    utm_source: o.utm_source || '',
    utm_medium: o.utm_medium || '',
    utm_campaign: o.utm_campaign || '',
    has_gclid: !!o.gclid,
    has_gbraid: !!o.gbraid,
    has_wbraid: !!o.wbraid,
    gad_campaignid: o.gad_campaignid || '',
    gad_campaignid_source: o.gad_campaignid_source || '',
    google_click_id_source: o.google_click_id_source || '',
    landing_has_napm: String(o.landing || '').includes('NaPm='),
    landing_has_srsltid: String(o.landing || '').includes('srsltid=')
  });
  const d = window.__THECLEANCOFFEE_SERVER_PAYMENT_DECISION_LAST__;
  return {
    href: location.href,
    referrer_host: document.referrer ? new URL(document.referrer).host : '',
    last_touch: pick(read(localStorage, '_p1s1a_last_touch')),
    coffee_click_context_local: pick(read(localStorage, '__thecleancoffee_click_id_context_v1')),
    coffee_click_context_session: pick(read(sessionStorage, '__thecleancoffee_click_id_context_v1')),
    checkout_context: pick(read(sessionStorage, '__seo_checkout_context')),
    payment_success_context: pick(read(sessionStorage, '__seo_payment_success_context')),
    decision: d ? {
      eventName: d.eventName || '',
      status: d.status || '',
      branch: d.branch || '',
      matchedBy: d.matchedBy || ''
    } : null
  };
})()
```

## 성공 기준

- landing 직후: `coffee_click_context_*` 또는 `last_touch`에 `has_gclid=true` 또는 `has_gbraid=true`.
- 주문서: `checkout_started` VM Cloud row에 Google click evidence와 `gad_campaignid`가 존재.
- 결제완료: `payment_success` VM Cloud row에 Google click evidence와 `gad_campaignid`가 존재.
- 미입금 가상계좌: Purchase로 통과되지 않고 unknown/pending 계열로 격리.

## 실패 시 분기

- landing에는 있음, 주문서에는 없음: Block 2 checkout 복원 경로 문제.
- 주문서에는 있음, 결제완료에는 없음: Block 3 payment_success 복원 경로 문제.
- 브라우저에는 있음, VM Cloud row에는 없음: endpoint payload field mapping 또는 dedupe 문제.
- `gad_campaignid`만 있고 click id 없음: campaign hint 보존은 됐지만 Google Ads upload 후보는 아니다.

## 금지선

- Google Ads API mutate/upload 없음.
- Google Ads conversion action 변경 없음.
- GTM/Imweb 운영 publish 없음.
- 운영DB write 없음.
- VM Cloud deploy/restart 없음.

## 2026-05-27 실행 결과

관측 시각: 2026-05-27 11:01 KST 전후
Source/window/freshness/confidence: TJ님 완료 URL + VM Cloud `/api/attribution/ledger?source=thecleancoffee_imweb`, 최근 90분 window, same-minute freshness, confidence 0.93

결론: PASS. 같은 주문 흐름에서 `checkout_started`와 `payment_success` 2개 row가 확인됐고, 둘 다 Google click evidence를 보존했다.

확인된 값:

- `utm_source=google`
- `utm_medium=cpc`
- `utm_campaign=coffee_google_smoke_0527`
- `gclid` present
- `gbraid` present
- `wbraid` absent
- `gad_source=1`
- `gad_campaignid=14629255429`
- 브라우저 콘솔: `last_touch`, `coffee_click_context_local`, `coffee_click_context_session`에서 Google click evidence present.
- 브라우저 콘솔: `checkout_context`, `payment_success_context`는 UTM/click evidence가 비어 보임.

해석:

- Coffee 브라우저 저장/복원 경로는 Google click id를 주문서와 결제완료까지 보존한다.
- `checkout_context`/`payment_success_context` 빈값은 VM Cloud row의 click evidence present와 충돌하지 않는다. 현재 gap은 서버 수신 실패가 아니라 sessionStorage debug snapshot의 병합 부족이다.
- 이번 값은 synthetic click id라서 Google Ads upload 가능성 검증이 아니다.
- 다음 예산 판단 단계는 실제 Google Ads API 클릭/비용 window와 내부 confirmed 주문 원장 window를 맞추는 것이다.
