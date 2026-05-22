# 더클린커피 Meta 중간 이벤트 Footer No-Send Preview 삽입 승인안

작성 시각: 2026-05-22 01:30 KST
기준일: 2026-05-22
문서 성격: 더클린커피 Imweb footer no-send preview 운영 삽입 승인안
Lane: Red for Imweb footer save / No platform send

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/coffee-data/RULES.md
    - harness/coffee-data/VERIFY.md
  required_context_docs:
    - project/coffee-meta-middle-funnel-browser-fallback-nosend-snippet-20260522.md
    - project/coffee-meta-middle-funnel-browser-fallback-comparison-20260522.md
    - project/coffee-imweb-live-smoke-result-20260522.md
    - imweb/code_backup_coffee0522.md
  lane: Red
  allowed_actions_after_explicit_approval:
    - paste no-send preview snippet into thecleancoffee Imweb footer code slot
    - save footer code
    - run live no-send browser smoke
  forbidden_actions:
    - Meta browser InitiateCheckout actual send
    - facebook.com/tr image beacon
    - Meta CAPI enable
    - GTM Production publish
    - actual checkout or purchase
    - production DB or VM Cloud SQLite write
  source_window_freshness_confidence:
    source: local no-send snippet + Playwright smoke + live read-only DOM investigation
    window: 2026-05-22 01:30 KST
    freshness: immediately after Coffee Imweb full replacement
    confidence: 0.87
```

## 10초 요약

이 승인안은 더클린커피 결제 페이지에서 Meta 중간 이벤트 후보를 실제 전송 없이 먼저 관찰하기 위한 것이다.

삽입할 코드는 `InitiateCheckout` 후보 payload를 `dataLayer`와 debug console에만 남긴다. `fbq`, `facebook.com/tr`, Meta CAPI, GA4, Google Ads, Naver 전송은 하지 않는다.

2026-05-22 10:50 KST 기준 상품상세 URL에서 이미 `InitiateCheckout` active와 `currency=KRW`, `value=33900.00`이 확인됐다. 이어서 상품상세 CTA 1회성 audit에서 `fbq('track', 'InitiateCheckout')` 1건과 `eventID_present=true`가 확인됐다.

따라서 이 승인안은 실행하지 않는다. checkout page load에 `InitiateCheckout` fallback을 넣으면 중복 위험이 크다.

Imweb footer 저장은 운영 사이트 전체 script를 바꾸므로 Red Lane이다. TJ님 명시 승인 전에는 붙여넣지 않는다.

## 승인하면 실제로 하는 일

현재 판정: STOP. 아래 작업은 현재 승인 대상으로 보지 않는다.

더클린커피 Imweb 관리자에서 현재 footer code 슬롯에 아래 후보를 추가한다.

- 화면: 더클린커피 Imweb 관리자
- 위치: 현재 `<푸터 코드>`가 들어 있는 코드 삽입 슬롯
- 붙일 코드: `scripts/coffee-meta-middle-funnel-browser-fallback-nosend-snippet.js` 내용을 `<script>...</script>`로 감싼 것
- 변경 효과: `/shop_payment/`에서 중간 이벤트 후보가 `dataLayer` preview로 남는다
- 안 바꾸면 남는 문제: Pixel Helper에서 checkout 단계 `InitiateCheckout/AddPaymentInfo`가 계속 비어 있는 원인을 운영 checkout session에서 확인하기 어렵다

## 허용 범위

1. no-send preview snippet을 footer에 추가한다.
2. 저장 후 `/shop_payment/`에서 `__seo_attribution_debug=1`을 붙여 preview 로그를 확인한다.
3. `window.__THECLEANCOFFEE_META_MIDDLE_FUNNEL_PREVIEW_LAST__`와 `dataLayer`의 `coffee_meta_middle_funnel_preview`만 확인한다.
4. Network 탭에서 `facebook.com/tr?ev=InitiateCheckout`가 0건인지 확인한다.

## 금지 범위

1. 실제 `fbq('track', 'InitiateCheckout')` 호출 금지.
2. `new Image()`로 `facebook.com/tr` 호출 금지.
3. Meta CAPI `enableServerCapi=true` 전환 금지.
4. GTM Production publish 금지.
5. 실제 결제 버튼 클릭 또는 구매 테스트 금지.
6. 운영DB 또는 VM Cloud SQLite write 금지.

## 성공 기준

1. checkout URL에서 console에 `[coffee-meta-middle-funnel-nosend] preview`가 보인다.
2. `window.__THECLEANCOFFEE_META_MIDDLE_FUNNEL_PREVIEW_LAST__`가 생긴다.
3. payload에 `eventName: InitiateCheckout`, `noSend: true`, `noFbq: true`, `noPixelRequest: true`가 있다.
4. `customData.currency`는 `KRW`다.
5. value가 잡히면 실제 주문서 표시 금액과 일치한다.
6. value가 안 잡히면 `value: null`, `value_status: missing`으로 남는다.
7. raw order code, order no, member code, click id가 payload/log에 노출되지 않는다.
8. Network 탭에서 새 `facebook.com/tr?ev=InitiateCheckout` 요청은 0건이다.

## Hard Fail

아래 중 하나라도 발생하면 즉시 footer에서 snippet을 제거한다.

1. Pixel Helper에 새 `InitiateCheckout`이 실제 이벤트로 보인다.
2. Network 탭에 `facebook.com/tr?ev=InitiateCheckout` 요청이 생긴다.
3. `att.ainativeos.net/api/meta/capi/track` 요청이 생긴다.
4. raw order/member/click id가 console 또는 dataLayer에 그대로 찍힌다.
5. 페이지 이동, 결제 버튼, 장바구니, 주문서 렌더링에 사용자 영향이 생긴다.

## Rollback

1. Imweb footer code 슬롯에서 이번 no-send snippet block만 제거한다.
2. 저장한다.
3. checkout URL을 새로 열어 `window.__THECLEANCOFFEE_META_MIDDLE_FUNNEL_NOSEND__`가 없는지 확인한다.
4. Pixel Helper와 Network 탭에서 새 중간 이벤트가 없는지 확인한다.

## GTM Preview를 1순위로 두지 않는 이유

GTM Preview는 안전한 보조 검증에는 좋다. 하지만 Coffee의 현재 문제는 GTM 이벤트가 아니라 Imweb/FBE browser 이벤트가 checkout에서 원래 안 만들어지는 것이다.

Biocom식 구조는 browser Pixel 흐름과 footer wrapper가 중심이다. 따라서 최종 운영 경로를 검증하려면 footer no-send preview가 더 직접적이다.

GTM Preview는 실제 checkout session에서 value selector가 계속 불확실할 때만 보조로 사용한다. Production publish는 별도 Red 승인 없이는 하지 않는다.

## 보류 해제 조건

현 조건에서는 보류 해제하지 않는다.

1. 상품상세 `InitiateCheckout`은 CTA 1회 클릭당 1건으로 확인됐다.
2. 상품상세 `InitiateCheckout`에 eventID도 붙는다.
3. checkout page load에서 추가 `InitiateCheckout`을 만들 필요가 없다.
4. `SubscribedButtonClick`은 일반 상품 옵션 드롭다운에서도 발생해 오탐/노이즈 후보로 분리했다.
5. 남은 작업은 `/subscription`의 실제 `정기구독 신청` 버튼 기준 구독 intent 설계와 `AddPaymentInfo` 별도 설계다.
