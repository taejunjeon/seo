# 더클린커피 GA4 중간 이벤트 보강 설계

작성 시각: 2026-05-17 17:20 KST
Lane: Green design / no-send / no-publish
대상: thecleancoffee

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - data/!data_inventory.md
    - harness/coffee-data/README.md
    - harness/coffee-data/RULES.md
    - harness/coffee-data/VERIFY.md
  lane: Green
  allowed_actions:
    - read_only_design
    - official_docs_review
    - approval_packet_draft
  forbidden_actions:
    - ga4_measurement_protocol_send
    - meta_capi_send
    - gtm_publish
    - imweb_header_footer_save
    - vm_cloud_deploy_or_restart
    - operating_db_write
  source_window_freshness_confidence:
    source: GA4 BigQuery daily export + VM Cloud SQLite safe bridge dry-run + Google official GA4 docs
    window: latest rolling 7d
    freshness: 2026-05-17 runtime dry-run
    confidence: high for gap existence, medium_high for implementation plan
```

## 한 줄 결론

더클린커피는 VM Cloud 결제완료 세션 대부분에서 GA4 `purchase` 이벤트도 보이지만, GA4의 결제 시작·결제수단 입력 이벤트가 비어 있어 “구매 전에 무엇이 구매를 예고하는지”를 GA4만으로 볼 수 없다. 다만 TJ님이 2026-05-17 GTM UI에서 기존 `HURDLERS 네이버페이구매 (장바구니)`와 `GA4 page_view_long` 태그를 확인했으므로, 지금은 새 태그를 바로 만들기보다 기존 태그를 먼저 재사용·검증하는 것이 맞다.

## 현재 관측

| 항목 | 값 |
|---|---:|
| VM Cloud confirmed purchase safe sessions | 326 |
| GA4 joined confirmed sessions | 316 |
| confirmed join rate | 96.93% |
| VM Cloud dropped checkout safe sessions | 378 |
| GA4 joined dropped sessions | 357 |
| dropped join rate | 94.44% |
| GA4 confirmed purchase 세션 중 `begin_checkout` | 0% |
| GA4 confirmed purchase 세션 중 `add_payment_info` | 0% |
| GA4 confirmed purchase 세션 중 `purchase` | 99.05% |

## 2026-05-17 기존 GTM 태그 발견 반영

TJ님 캡처 기준 더클린커피 GTM에는 이미 아래 태그가 있다.

- `HURDLERS - [데이터레이어] 네이버페이구매 (장바구니)`: 장바구니에서 네이버페이 구매 의도나 선택 상품을 dataLayer로 만드는 태그로 보인다. 이 신호는 실제 결제완료가 아니라 `NPay 장바구니/구매 의도` evidence다.
- `GA4 page_view_long 이벤트`: 오래 머문 사람을 GA4 `page_view_long`으로 보내는 태그다. 이 이벤트는 선행지표 분석에 쓸 수 있지만, `value=100`, `currency=KRW`는 매출로 쓰면 안 된다.

따라서 설계 우선순위를 바꾼다.

1. 기존 태그가 GTM Preview에서 실제 발화되는지 먼저 확인한다.
2. 그 태그가 GA4 BigQuery에 어떤 event name과 parameter로 남는지 확인한다.
3. 기존 태그로 `view_cart`, `begin_checkout`, `add_payment_info`, `page_view_long`을 설명할 수 있으면 새 태그는 만들지 않는다.
4. 기존 태그가 `NPay intent`만 만들고 표준 ecommerce event를 만들지 못하는 경우에만 최소 보강안을 만든다.

이전 설계의 보정:

- “중간 이벤트가 없다”는 말은 GA4 BigQuery에서 표준 ecommerce 이벤트명이 비어 있다는 뜻이었다.
- 최신 GTM UI 기준으로 관련 태그 자체가 없다는 뜻은 아니었다.
- 더클린커피 live tracking inventory는 2026-05-01 기준으로 stale이므로, live inventory refresh가 먼저다.

## 쉬운 설명

지금 더클린커피는 “VM Cloud 결제완료 세션에 대응되는 GA4 `purchase`는 대체로 보이는데, 구매 직전의 계단이 비어 있는 상태”다.

예를 들어 실제로 고객이 상품을 보고, 장바구니를 담고, 결제 페이지까지 갔다가 구매했더라도 GA4에는 중간 단계인 `begin_checkout`과 `add_payment_info`가 없다. 그래서 GA4 화면만 보면 결제 시작 없이 구매가 갑자기 생긴 것처럼 보인다.

다만 GTM에는 이미 장바구니/NPay/page_view_long 관련 태그가 있을 수 있다. 그래서 지금 해야 할 일은 새 이벤트를 무조건 심는 것이 아니라, “이미 잡히는 행동”과 “GA4 표준 이름으로 아직 안 잡히는 행동”을 분리하는 것이다.

이 문제는 매출 정본 문제가 아니다. 실제 결제완료 매출 정본은 Imweb/결제 원장이고, VM Cloud는 그 결제완료와 유입 evidence를 모아 보는 수집/보조 원장이다. GA4 `purchase`는 행동 분석 cross-check이지 예산 판단용 매출 정본이 아니다. 이 설계의 목적은 매출을 새로 만들거나 전송하는 것이 아니라, 구매 전에 어떤 행동이 구매를 예고하는지 볼 수 있게 중간 행동을 계측하는 것이다.

## 공식 문서 기준

Google Analytics 공식 문서는 전자상거래 분석을 위해 `add_to_cart`, `view_cart`, `begin_checkout`, `add_payment_info`, `purchase`, `refund` 같은 recommended ecommerce event를 명시한다. 또한 ecommerce event는 자동 수집이 아니라 사이트나 앱에서 직접 보내야 보고서에 의미 있게 잡힌다고 설명한다.

참조:

- Google Analytics recommended events: https://support.google.com/analytics/answer/9267735
- Google Analytics ecommerce measurement guide: https://developers.google.com/analytics/devguides/collection/ga4/ecommerce
- Google Analytics recommended event reference: https://developers.google.com/analytics/devguides/collection/ga4/reference/events

## 이벤트 설계

### 0. 기존 `page_view_long`

무엇을 할 것인가: 오래 머문 방문을 `page_view_long` 선행지표로 쓴다.

왜 필요한가: 구매자와 이탈자의 평균 체류시간 차이를 볼 수 있다.

어떻게 할 것인가:

- GTM Preview에서 `page_view_long` 태그가 실제 발화되는지 확인한다.
- GA4 BigQuery에서 event name `page_view_long`이 thecleancoffee 속성에 들어오는지 확인한다.
- `value=100`은 행동 점수로만 보고, 매출이나 ROAS 분자로 쓰지 않는다.

### 0-2. 기존 HURDLERS 네이버페이 장바구니 태그

무엇을 할 것인가: 장바구니에서 네이버페이 구매 의도를 나타내는 보조 신호로 쓴다.

왜 필요한가: NPay는 클릭, 결제 시작, 실제 결제완료가 섞이면 ROAS가 오염된다. 기존 태그는 그중 “장바구니/NPay 의도”를 분리하는 데 쓸 수 있다.

어떻게 할 것인가:

- GTM Preview에서 어떤 dataLayer event를 push하는지 확인한다.
- GA4 이벤트로 이어지는지, 아니면 dataLayer 내부 신호로만 끝나는지 확인한다.
- 이 신호는 `purchase`로 승격하지 않고, `npay_cart_intent` 또는 `npay_intent` evidence로만 둔다.

### 1. `view_cart`

무엇을 할 것인가: `/shop_cart` 또는 장바구니 화면 진입을 GA4 `view_cart`로 보낸다.

왜 필요한가: 더클린커피에서 장바구니를 본 세션이 구매로 이어지는지 확인할 수 있다.

어떻게 할 것인가:

- VM Cloud에는 이미 landing/path 기반 장바구니 페이지 진입을 볼 수 있다.
- GTM에 기존 HURDLERS 장바구니 보기/네이버페이 장바구니 태그가 있는지 먼저 확인한다.
- 기존 태그가 GA4 `view_cart`를 이미 만든다면 새 태그를 만들지 않는다.
- 기존 태그가 dataLayer intent만 만들고 GA4 `view_cart`는 만들지 않는다면 최소 보강안을 별도 승인안으로 둔다.
- value는 구매 매출로 쓰지 않고 cart_value 정도의 참고값으로만 둔다.

### 2. `begin_checkout`

무엇을 할 것인가: 더클린커피 checkout 시작 또는 `/shop_payment/` 진입을 GA4 `begin_checkout`로 보낸다.

왜 필요한가: 구매 직전 단계의 핵심 분모다. 구매자는 `begin_checkout → purchase`, 이탈자는 `begin_checkout → no purchase`로 비교할 수 있다.

어떻게 할 것인가:

- VM Cloud `payment_page_seen`과 같은 순간을 기준으로 삼는다.
- GA4 이벤트에는 `currency=KRW`, `value`, `items`를 가능한 범위에서 넣되, 실제 purchase revenue로 합산하지 않도록 `purchase`와 분리한다.
- NPay 클릭은 구매완료가 아니므로 `begin_checkout` 또는 별도 `npay_intent` 보조 evidence로만 둔다.

### 3. `add_payment_info`

무엇을 할 것인가: 결제수단이 단순히 보이거나 커서가 올라간 시점이 아니라, 결제정보 제출 또는 결제수단 선택이 확실히 확인된 시점에만 GA4 `add_payment_info`를 보낸다.

왜 필요한가: 결제수단 선택 이후 이탈과 실제 구매 전환의 차이를 볼 수 있다.

어떻게 할 것인가:

- 결제수단 선택값이 확실하고, 사용자가 결제수단 단계까지 실제로 진행했다는 evidence가 있을 때만 보낸다.
- `payment_type`은 `card`, `npay`, `virtual_account`, `bank_transfer`, `unknown`처럼 제한된 enum으로만 보낸다.
- 가상계좌/무통장 발급은 purchase가 아니므로 `add_payment_info` 이후에도 결제완료 확인 전에는 구매로 올리지 않는다.

### 4. `purchase`

무엇을 할 것인가: 기존 GA4 purchase는 유지하되, 중복 방지를 먼저 점검한다.

왜 필요한가: 더클린커피 GA4 purchase는 이미 존재한다. 지금 문제는 purchase가 없는 것이 아니라 중간 단계가 비어 있는 것이다.

어떻게 할 것인가:

- 신규 설계에서는 purchase를 추가 발화하지 않는다.
- purchase가 중복되거나 transaction_id가 synthetic인 과거 패턴은 그대로 guard 대상으로 둔다.
- 실제 매출 정본은 VM Cloud Imweb actual source를 우선한다.

## 구현 경로

### Green: 설계와 dry-run

- VM Cloud와 GA4 BigQuery를 read-only로 계속 비교한다.
- 더클린커피 `begin_checkout/add_payment_info` 0 현상을 모니터링한다.
- raw id 없이 safe session bridge로 구매자/이탈자 행동 차이를 분석한다.

### Yellow: 테스트 적용

- 아임웹 코드 또는 GTM workspace에서 test-only/preview로 이벤트를 발화한다.
- GA4 DebugView 또는 BigQuery 다음날 export에서 이벤트가 보이는지 확인한다.
- 실제 GA4 production publish, GTM publish, footer/header 저장은 TJ님 승인 전 중지한다.

### Red: 운영 전송/게시

- GA4 production 이벤트 발화, GTM publish, 아임웹 header/footer 저장은 모두 Red 또는 Yellow approval 대상이다.
- 승인 전에는 purchase, Meta CAPI, Google Ads, TikTok, Naver 전송을 추가하지 않는다.

## Plan B: raw id debug

이번 설계에서는 raw id를 사용하지 않았다.

더클린커피 특정 주문 1건이 GA4 purchase와 VM Cloud order 사이에서 닫히지 않을 때만, TJ님 승인 후 secure local/VM evidence 내부에서 raw order/payment key를 사용한다.

보고서·대화·Telegram·git에는 raw 값을 쓰지 않고 safe_ref와 집계만 남긴다.

## gpt-5.5 pro web feedback 반영

- `view_cart`, `begin_checkout`, `add_payment_info`, `purchase`를 분리하는 방향은 Google Analytics ecommerce recommended events와 맞다.
- 기존 GA4 `purchase`를 새로 발화하지 않는 판단이 안전하다. 지금 문제는 purchase 부재가 아니라 중간 이벤트 gap이다.
- 구현 전에는 GTM/아임웹/기존 wrapper/server send inventory를 먼저 다시 확인해야 한다. 같은 중간 이벤트가 기존 코드와 중복 발화되면 행동 분석이 오염된다.
- 더클린커피 `dropped_checkout` 후보에도 GA4 purchase가 일부 보이므로, 구현 전 “진짜 이탈”과 “나중 구매/세션 재생성/window 차이”를 분리하는 재검증이 필요하다.
- 새 중간 이벤트의 `value`는 행동 분석 참고값으로만 쓰고, 실제 매출 정본처럼 표시하지 않는다.

## Claude Code 프론트/구현 handoff

프론트는 Claude Code가 구현한다.

화면에 필요한 사람말 필드:

- “장바구니를 봄”
- “결제 시작”
- “결제수단 선택”
- “실제 결제완료”
- “GA4에는 아직 중간 이벤트 없음”
- “VM Cloud 기준으로는 결제 페이지까지 감”

API/데이터 필드:

- `site`
- `window`
- `source`
- `vm_payment_page_seen_sessions`
- `ga4_begin_checkout_sessions`
- `ga4_add_payment_info_sessions`
- `ga4_purchase_sessions`
- `safe_bridge_join_rate`
- `freshness`
- `confidence`

## 다음 액션

1. 더클린커피 GTM live inventory를 최신화한다. 기존 `page_view_long`, HURDLERS 장바구니/NPay, HURDLERS `view_cart/begin_checkout/add_payment_info` 계열 태그가 실제로 있는지 확인한다.
2. GTM Preview에서 기존 태그가 어떤 화면과 클릭에서 발화되는지 확인한다. 신규 태그 생성은 하지 않는다.
3. GA4 BigQuery에서 `page_view_long`, HURDLERS 장바구니 계열 event name, `view_cart`, `begin_checkout`, `add_payment_info`가 실제로 들어오는지 확인한다.
4. 기존 태그로 설명되지 않는 gap만 보강 대상으로 남긴다.
5. purchase는 건드리지 않는다. 현재 문제는 actual 매출 부재가 아니라 중간 행동 event name gap이다.
