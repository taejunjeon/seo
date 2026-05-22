# 더클린커피 Imweb 교체 후 Live Smoke 결과

작성 시각: 2026-05-22 00:35 KST
기준일: 2026-05-22
문서 성격: 더클린커피 Imweb 전체 코드 교체 후 read-only/no-send 검증 결과
Lane: Green read-only smoke / no-send / no-write / no-publish

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/coffee-data/RULES.md
  required_context_docs:
    - imweb/code_backup_coffee0522.md
    - project/coffee-imweb-full-paste-candidate-20260522.md
  lane: Green
  allowed_actions:
    - live_html_readonly_fetch
    - browser_storage_smoke_with_external_requests_stubbed
    - meta_eventid_no_send_synthetic_smoke
  forbidden_actions:
    - actual checkout or purchase
    - Imweb save/publish
    - GTM Production publish
    - Google Ads conversion upload
    - GA4/Meta/Google Ads production send toggle
    - production DB or VM Cloud SQLite write
  source_window_freshness_confidence:
    source: https://thecleancoffee.com live HTML + Playwright local browser smoke
    window: 2026-05-22 00:31-00:35 KST
    freshness: immediately after TJ completed Imweb full replacement
    confidence: 0.90
```

## 10초 요약

더클린커피 Imweb 전체 코드 교체 후 새 Google 클릭 ID 저장 코드가 라이브 HTML에 반영된 것을 확인했다.

로컬 브라우저에서 외부 광고·분석 요청은 stub/차단하고, `gclid`, `gbraid`, `wbraid`, `gad_campaignid` 저장 동작을 확인했다. 3개 케이스 모두 통과했고, Meta CAPI 전송도 0건이었다.

남은 확인은 실제 사용자 브라우저에서 extension/DevTools로 보는 수동 smoke다. 실제 결제나 GTM publish는 아직 하지 않는다.

## 확인된 것

1. 라이브 HTML 반영 확인
   - HTTP status: 200
   - 새 header version: `2026-05-22-thecleancoffee-click-id-structured-v1`
   - 새 storage key: `__thecleancoffee_click_id_context_v1`
   - footer Block 1 version: `2026-05-22-thecleancoffee-footer-block1-click-id-v1`
   - checkout_started version: `2026-05-22-coffee-checkout-started-click-id-v1`
   - payment_success version: `2026-05-22-coffee-payment-success-click-id-v1`
   - Coffee GTM/GA4/Pixel 유지: `GTM-5M33GC4`, `G-JLSBXX7300`, `1186437633687388`
   - Biocom click context key/container 혼입: 없음
   - Meta CAPI config: `enableServerCapi=false`

2. Google 클릭 저장 live smoke
   - 새 `gclid+gbraid` + 이전 stale `wbraid`: `wbraid=""`, `has_google_click_id=true`, PASS
   - 새 `wbraid only`: `wbraid` 보존, `has_google_click_id=true`, PASS
   - `gad_campaignid only` + 이전 stale click id: `gclid/gbraid/wbraid=""`, `has_google_click_id=false`, PASS
   - console error: 0
   - `gtag` conversion call: 0

3. Meta browser eventId no-send smoke
   - Phase 9 wrapper installed: `2026-04-15-thecleancoffee-funnel-capi-v3`
   - `enableServerCapi=false`
   - synthetic events observed: 4/4
   - eventID missing: 0
   - CAPI fetch calls: 0
   - `facebook.com/tr` requests: 0
   - console error: 0

4. TJ님 실제 Chrome 확인
   - Google click context 저장 확인: PASS
   - `gclid`: `TJ_GCLID_0522`
   - `gbraid`: `TJ_GBRAID_0522`
   - `wbraid`: 빈 값
   - `gad_campaignid`: `14629255429`
   - `has_google_click_id`: `true`
   - `google_click_id_source`: `current_url`
   - Phase 9 wrapper: installed, `enableServerCapi=false`
   - 상품 상세 `ViewContent` eventID 확인: `ViewContent.75.mpfnp27y1z4ud1`

5. 결제 페이지 Meta 이벤트 진단
   - 기준 시각: 2026-05-22 00:43 KST
   - TJ님 Pixel Helper 관측: 상품 상세에서는 `ViewContent`가 보이나 결제 페이지에서는 기대한 결제 단계 이벤트가 보이지 않음.
   - Codex no-send 재현: `/shop_payment/` 진입 시 `checkout_started` payload는 생성되지만, Meta `fbq('track', ...)` 호출은 `PageView`만 관측됨.
   - 해석: 현재 footer Phase 9는 Imweb/aimweb이 이미 쏘는 Meta 이벤트에 eventID를 주입하고 서버 CAPI mirror 후보를 만드는 구조다. 결제 페이지에서 Imweb이 `InitiateCheckout` 또는 `AddPaymentInfo`를 쏘지 않으면 Pixel Helper에 새 결제 단계 이벤트가 나타나지 않는다.
   - 결론: 반복 사용자 테스트보다 GTM Preview용 no-send 후보 설계가 다음 단계다.

6. TJ님 실제 checkout/session 추가 확인
   - 기준 시각: 2026-05-22 10:49-10:50 KST
   - checkout 페이지 selector 확인: `document.querySelectorAll('._payment_total_price, .total_price, [data-payment-total], [data-order-total], [data-total-price], .im-price-result, .im-order-price').length` 결과 0.
   - 해석: 명령 실행 방식은 맞다. 다만 해당 selector 묶음은 현재 실제 checkout DOM의 주문 요약 금액 요소와 매칭되지 않는다.
   - 추가 DOM 결과: `#oms-shop-payment` 내부의 `주문 요약` / `총 주문금액` 텍스트에 실제 금액이 포함된다. class는 `css-*` 해시형이라 운영 selector로 직접 쓰지 않고, `총 주문금액` 라벨 기반 파싱을 우선 후보로 둔다.
   - Pixel Helper 관측: 상품상세 URL에서 `InitiateCheckout`이 active로 잡히고, `currency=KRW`, `value=33900.00`이 들어온다.
   - 의미: Coffee에 `InitiateCheckout`이 아예 없는 것은 아니다. 상품상세 CTA 또는 Imweb/FBE 흐름에서 이미 생성되는 것으로 보인다. checkout page load에 같은 이벤트를 새로 만들면 중복 위험이 있으므로 실제 send 설계는 HOLD로 낮춘다.
   - 추가 관측: `SubscribedButtonClick`이 상품상세 URL에서 자동 감지 이벤트로 2건 보인다. 이 이벤트가 정기구독 CTA에서 의도된 것인지, Meta 자동 감지 오탐인지 별도 검증 목록에 넣는다.
   - 상품상세 CTA 1회성 audit: 상품상세 URL에서 CTA 1회 클릭 시 `fbq('track', 'InitiateCheckout')` 1건만 관측됐다. `currency=KRW`, `value=33900.00`, `eventID_present=true`.
   - 판정: `InitiateCheckout` browser event는 이미 정상이다. checkout page load 기반 `InitiateCheckout` fallback은 불필요하며, 실제 send로 만들면 중복 위험이 크다.
   - `SubscribedButtonClick` 추가 관측: 일반 상품상세의 `방탄커피 (필수)` 옵션 드롭다운을 누를 때마다 1건씩 발생한다. 정기구독 상품은 `/subscription` 및 `/subscription/?idx=74`에 별도 존재하며, 옵션 선택과 `정기구독 신청` 버튼은 다른 행동이다.
   - 정기구독 페이지 추가 관측: 옵션 드롭다운 선택마다 1건, `정기구독 신청` 버튼 클릭 시 1건이 추가되어 총 3건의 `SubscribedButtonClick`이 보이고 이후 `InitiateCheckout`이 별도로 발생한다.
   - source 판정: Coffee 라이브 HTML/GTM/우리 footer에서 직접 `SubscribedButtonClick`을 호출하는 코드는 확인되지 않았다. Meta `fbevents.js` 내부에는 `SubscribedButtonClick` 및 button automatic detection 관련 코드가 존재한다. 따라서 Meta Pixel 내부 자동 감지로 본다.
   - 판정: 현재 `SubscribedButtonClick`은 정기구독 신청 근거가 아니라 Meta 자동 감지 오탐/노이즈 후보로 본다. 구독 성과나 ROAS 판단에는 쓰지 않는다.
   - TJ님 승인: `SubscribedButtonClick`은 보고서에서 제외한다.
   - 후속 Green 작업: 구독 intent는 `SubscribedButtonClick`을 쓰지 않고 `/subscription`의 실제 `정기구독 신청` 버튼 조건만 내부 no-send preview로 분리했다. 설계 문서: `project/coffee-subscribe-intent-nosend-design-20260522.md`.
   - 로컬 fixture 결과: `scripts/coffee-subscribe-intent-nosend-smoke.mjs` 9/9 PASS. 옵션 드롭다운, 일반 구매, 장바구니, 모바일 옵션 열기 버튼은 preview 0건이고 실제 신청 버튼만 preview 1건이다.

## 하지 않은 것

- 실제 상품 클릭, 장바구니 담기, 결제 시작, 결제 완료는 하지 않았다.
- Google Ads, GA4, Meta, Naver로 실제 전환 전송을 의도적으로 만들지 않았다.
- Imweb 재저장, GTM publish, VM Cloud/운영DB write는 하지 않았다.

## 다음 확인

1. TJ님 실제 브라우저에서 Google 클릭 저장을 1회 확인한다.
2. Meta Pixel Helper에서는 상품 상세 `ViewContent`의 Event ID 상세만 1회 확인한다.
3. 결제 페이지 `InitiateCheckout`은 새로 만들지 않는다. 상품상세 CTA 1회 클릭에서 value/currency/eventID 포함 1건으로 확인됐다.
4. `SubscribedButtonClick` 자동 감지 2건이 의도된 신호인지 검증한다.
5. 다음 설계 대상은 `AddPaymentInfo` 또는 checkout value 관측 no-send이며, 실제 Meta send는 별도 승인 전 금지한다.
6. `SubscribedButtonClick`은 Meta 자동 감지 노이즈 후보로 분리하고, 구독 intent가 필요하면 `/subscription`의 `정기구독 신청` 버튼 기준으로 별도 no-send 설계를 만든다.
7. 구독 intent no-send는 로컬 fixture까지 완료했다. 다음은 운영 반영이 아니라 TJ님 실제 Chrome에서 `/subscription/?idx=74` 수동 no-send smoke를 할지 결정하는 것이다.
