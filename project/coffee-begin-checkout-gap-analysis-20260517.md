# 더클린커피 구매하기 이후 begin_checkout gap 분해

작성 시각: 2026-05-18 02:54 KST
대상 사이트: 더클린커피 (`thecleancoffee.com`)
문서 성격: Green Lane 분석. GTM Publish, VM Cloud 배포, 외부 전송은 하지 않았다.

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - harness/coffee-data/README.md
  required_context_docs:
    - AGENTS.md
    - docurule.md
    - GA4/gtm-thecleancoffee.md
    - GA4/gtm-preview-only-checklist.md
    - data/project/gtm-ga4-full-inventory-20260517.json
  lane: Green
  allowed_actions:
    - read_only_inventory
    - local_gap_analysis
    - preview_checklist_design
  forbidden_actions:
    - gtm_publish
    - gtm_create_version
    - vm_cloud_deploy
    - platform_send
    - operational_db_write
  source_window_freshness_confidence:
    site: thecleancoffee
    gtm_container: GTM-5M33GC4
    ga4_property: analytics_326949178
    ga4_export_window: 2026-04-07..2026-05-16
    freshness: latest_ga4_export_2026-05-16
    confidence: high_for_static_gtm_and_bigquery_medium_for_live_button_flow_until_preview
```

## 10초 요약

더클린커피 GTM에는 `begin_checkout` 태그가 있다. 하지만 최근 GA4 BigQuery export에서는 `begin_checkout`, `view_cart`, `add_payment_info`가 모두 0이다. 현재 `begin_checkout`은 상품 상세의 구매하기 버튼 클릭이 아니라 `/shop_payment/` 주문서 화면 진입 후 DOM 조건이 맞을 때 발화하는 구조다. 따라서 구매하기 버튼을 눌렀는데 주문서 URL로 이동하지 않으면 `begin_checkout`이 안 뜨는 것이 정상이고, 주문서 URL까지 갔는데도 안 뜨면 GTM 트리거/DOM/dataLayer 조건 문제다.

## 현재 확인된 숫자

Source: 더클린커피 GA4 BigQuery `analytics_326949178`, export `2026-04-07..2026-05-16`.

- `view_item`: 3,438 events / latest 2026-05-16 23:25:51 KST
- `add_to_cart`: 1,603 events / latest 2026-05-16 21:44:34 KST
- `purchase`: 1,370 events / latest 2026-05-16 23:22:45 KST
- `view_cart`: 0
- `begin_checkout`: 0
- `add_payment_info`: 0

## 현재 GTM 구조

`begin_checkout`은 두 단계 체인이다.

1. `HURDLERS - [데이터레이어] 주문서작성`
   역할: 주문서 화면에서 상품 정보를 읽어 dataLayer에 `event=begin_checkout`을 push한다.
   실행 조건: `HURDLE - [DOM 사용 가능] 주문서작성`.

2. `HURDLES - [이벤트전송] 주문서작성`
   역할: dataLayer의 `begin_checkout` custom event를 받아 GA4 event `begin_checkout`을 보낸다.
   실행 조건: `HURDLE - [맞춤 이벤트] 주문서작성`.

즉, 상품 상세에서 “구매하기” 버튼을 누르는 순간이 아니라 “주문서 화면이 열리고, 주문서 DOM에서 상품 정보를 읽을 수 있을 때”가 현재 `begin_checkout` 기준이다.

## 2026-05-18 Preview 추가 관측

출처: TJ님 Tag Assistant / Meta Pixel Helper 스크린샷, read-only 해석. 대화와 문서에는 raw 주문/결제/member key를 남기지 않는다.

### 관측된 것

- 구매하기 버튼 이후 브라우저는 `/shop_payment/` 주문서 화면까지 이동했다.
- GTM Summary에서 `HURDLERS - [데이터레이어] 주문서작성`은 Fired로 확인됐다.
- 하지만 `HURDLES - [이벤트전송] 주문서작성` GA4 event tag는 Fired 목록에 보이지 않았다.
- Tag Assistant 좌측 이벤트 목록에도 `begin_checkout` custom event는 보이지 않았다.
- 콘솔 오류는 0으로 보였다.
- Meta Pixel Helper에는 `InitiateCheckout`이 보이지 않았고, 기존 상품상세 URL 기준 `PageView`/`SubscribedButtonClick`류만 보였다.

### 이번 관측으로 좁혀진 원인

이제 Gap A(상품상세에서 주문서로 이동하지 못함)는 제외한다. Gap B(URL이 주문서가 아님)도 가능성이 낮다. 주문서 화면에 도착했고, 주문서작성 Custom HTML 태그가 Fired 됐기 때문이다.

남은 핵심 원인은 Gap C다. 즉, `HURDLERS - [데이터레이어] 주문서작성` 태그는 실행됐지만 내부 스크립트가 실제 `dataLayer.push({ event: "begin_checkout", ... })`까지 성공하지 못했을 가능성이 가장 높다.

우선순위 높은 원인 후보:

1. 주문서 DOM selector가 현재 화면과 맞지 않아 상품 리스트를 못 읽었다.
2. `window.addEventListener("load", ...)` 방식 때문에 태그가 실행된 시점과 load event 시점이 어긋났다.
3. 수량/가격 파싱 중 중단되어 `products.length > 0` 조건을 통과하지 못했다.
4. dataLayer push는 됐지만 Tag Assistant 이벤트 목록에 보이지 않을 만큼 늦게 발생했다. 현재 증거만으로는 가능성이 낮다.

### 바로 필요한 확인

Tag Assistant에서 `HURDLERS - [데이터레이어] 주문서작성` 카드를 클릭해 “데이터 영역”에 `begin_checkout` event가 실제로 생겼는지 확인한다. 없으면 Custom HTML 내부 실패다. 있으면 GA4 event tag trigger mismatch다.

## 2026-05-18 데이터 영역 추가 관측

출처: TJ님 Tag Assistant 데이터 영역 복사값, read-only 해석. raw 주문/member query는 문서에 남기지 않았다.

### 스크롤 깊이 이벤트

현재 상품상세 화면에서 `gtm.scrollDepth`가 발생했다. `scrollThreshold=25`, `scrollUnits=percent`로 보이며, 화면상 25% 이상 스크롤 이벤트는 GTM이 정상 감지하고 있다.

이 의미는 명확하다. 더클린커피에서 스크롤 계열 선행지표는 GTM 런타임 자체가 죽어서 안 잡히는 문제가 아니다. `page_view_long` 또는 Scroll50 같은 더 깊은 체류/관심 지표를 만들려면 기존 스크롤 감지 기반을 활용할 수 있다.

### 구매하기 링크 클릭 이벤트

상품상세의 `구매하기` 클릭 시점에 `gtm.linkClick`이 발생했다. 클릭 대상은 `elementText=구매하기`, `elementClasses` 안에 `_btn_buy`가 포함되어 있다. 또한 같은 이벤트의 데이터 영역에 `hurdlers_ga4.items`가 붙어 있으며, 상품명, 상품 ID, 가격, 브랜드가 존재한다.

이 관측으로 제외되는 원인:

- 상품상세에서 구매하기 클릭 자체를 GTM이 못 보는 문제는 아니다.
- 상품 상세 상품 정보가 비어 있어서 다음 단계로 못 가는 문제도 아니다.
- “구매하기 클릭 선행지표”는 현재 GTM만으로 만들 수 있다.

남는 원인:

- 구매하기 클릭은 `gtm.linkClick`으로만 잡히고, 현재 더클린커피 GTM에는 이를 `begin_checkout`으로 보내는 표준 태그가 없다.
- 기존 `begin_checkout` 체인은 상품상세 클릭이 아니라 `/shop_payment/` 주문서 화면 DOM 기준이다.
- 따라서 현재 기준에서 `begin_checkout` 0의 직접 원인은 “구매하기 클릭 미감지”가 아니라 “구매하기 클릭과 주문서 DOM 이벤트 사이의 표준 이벤트 연결 부족”이다.

### 구매하기 클릭 이후 이벤트 순서

TJ님이 추가로 제공한 이벤트 21~30번 흐름을 보면 더 명확하다.

1. 21번 `gtm.click`: 상품상세의 `_btn_buy` 버튼 클릭이 잡혔다. 이 시점에도 `hurdlers_ga4.items`가 있다.
2. 22번 `gtm.linkClick`: 같은 구매하기 버튼이 링크 클릭으로 한 번 더 잡혔다. 이 시점에도 상품 item 정보가 있다.
3. 23~29번: `gtm.init_consent`, `gtm.init`, 여러 번의 `gtm.js`, `gtm.dom`, `gtm.load`가 이어진다. 이는 버튼 클릭 뒤 새 페이지 또는 새 컨테이너 흐름으로 넘어간 것으로 해석한다.
4. 30번 `gtm.scrollDepth`: 새 화면에서 25% 스크롤 이벤트가 잡혔다.

이 사이에 보이지 않는 것:

- `checkout_intent` custom event 없음.
- `begin_checkout` custom event 없음.
- `add_payment_info` custom event 없음.
- `purchase` event 없음.

따라서 이번 데이터는 두 가지를 동시에 말해준다.

- 상품상세 구매 버튼은 GTM에서 잘 보인다. 즉 “클릭이 안 잡혀서 문제”가 아니다.
- 하지만 그 클릭이 표준 구매 퍼널 이벤트로 바뀌지 않는다. 즉 “잡힌 클릭을 어떤 의미로 저장할지 정하는 태그/VM 이벤트 설계”가 비어 있다.

권장 판단:

- 상품상세 `구매하기` 클릭은 `checkout_intent`로 새로 저장한다. 의미는 “고객이 구매를 시작하려고 눌렀다”이다.
- `/shop_payment/` 주문서 화면에서 상품 정보가 실제로 읽힌 경우만 `begin_checkout`으로 저장한다. 의미는 “주문서 작성 단계에 들어왔다”이다.
- 이 둘을 합치면 안 된다. 그래야 “눌렀지만 주문서에서 끊긴 사람”과 “주문서까지 들어온 사람”을 구분할 수 있다.

### trigger ID 해석

제공된 `gtm.triggers`에는 `모든 링크 클릭`, 카카오채널/초대코드/네이버페이 관련 트리거 후보가 같이 보인다. 하지만 실제 클릭 대상은 일반 구매 버튼 `_btn_buy`이고, 네이버페이 버튼 클래스가 아니다. 따라서 이 값만 보고 네이버페이 구매 태그가 실행됐다고 해석하면 안 된다. 실제 실행 여부는 Summary의 Fired tag 목록과 Data Layer의 custom event 존재 여부로 판단해야 한다.

### 현재 결론

`checkout_intent`를 새로 두는 것이 맞다. 의미는 “고객이 상품상세에서 구매하기를 눌렀다”이다. 반면 `begin_checkout`은 “주문서 화면까지 들어와 주문서 상품 정보를 읽었다”로 유지하는 것이 맞다. 이렇게 나눠야 `구매하려고 눌렀지만 주문서 단계에서 끊긴 사람`과 `주문서까지 들어온 사람`을 따로 볼 수 있다.

## 2026-05-18 03:19 KST Codex Chrome 확인

상황: TJ님이 Chrome 두 곳에 켜져 있던 Codex Chrome Extension 중 하나를 껐다. 이후 Codex에서 Chrome Extension 연결을 재시도했다.

확인 결과:

- Codex Chrome Extension 연결은 정상 복구됐다.
- Tag Assistant 탭을 직접 읽었을 때 `begin_checkout` 이벤트는 여전히 보이지 않았다.
- 주문서 페이지의 `dataLayer`에도 `begin_checkout`은 0건이었다.
- 주문서 페이지 DOM은 로드되어 있었지만, 현재 HURDLERS 주문서작성 HTML이 찾는 selector는 모두 0개였다.

selector count:

- `.shop_item_thumb`: 0
- `.shop_item_title`: 0
- `.shop_item_pay > span`: 0
- `.shop_item_opt`: 0
- `#oms-shop-payment`: 존재
- body class에 `shop_payment`: 존재

해석:

Chrome 확장 충돌 가능성은 있었다. 한쪽 확장을 끈 뒤 Codex 연결이 복구됐기 때문이다. 하지만 `begin_checkout`이 안 생기는 직접 원인은 Chrome 확장이 아니라 GTM 주문서작성 Custom HTML의 DOM selector 불일치다.

현재 HTML은 `.shop_item_thumb` 안에서 상품명/가격/수량을 읽도록 되어 있다. 실제 주문서 화면은 `#oms-shop-payment` 기반으로 렌더링되고, `.shop_item_thumb` 계열 selector가 없다. 따라서 `products.length > 0` 조건을 통과하지 못해 `dataLayer.push({ event: "begin_checkout" })`가 실행되지 않는다.

추가로 현재 HTML은 실패에 약하다.

- `querySelector(...).innerText`를 바로 호출하므로 selector 하나만 없어도 전체 스크립트가 중단될 수 있다.
- `window.addEventListener("load", ...)`에만 의존하므로 GTM 태그 실행 시점이 load 이후면 callback이 실행되지 않을 수 있다.
- 수량 파싱이 `[0-9][개]` 한 자리 패턴이라 `10개`, `수량 1`, 옵션 문구 변화에 약하다.

따라서 수정 방향은 “기존 태그를 게시한다/안 한다” 문제가 아니라, 먼저 주문서 DOM에 맞게 주문서작성 Custom HTML을 안전하게 다시 쓰는 것이다.

## 2026-05-18 03:53 KST 다른 상품 주문서 재현 결과

상황: TJ님이 다른 상품에서 구매하기를 눌러 `/shop_payment/` 주문서 화면까지 진입했다. Tag Assistant에서 `AGENTSOS - [begin_checkout] 주문서작성` Custom HTML은 1회 Fired 되었지만, 좌측 이벤트 목록에 `begin_checkout` custom event는 생기지 않았다.

Codex Chrome read-only 확인:

- 주문서 화면의 기존 `.shop_item_*` selector는 0개였다.
- 화면 본문에는 상품명, 금액, 수량, 상품 링크가 있어 fallback parser로 상품 1개를 만들 수 있었다.
- AGENTSOS sessionStorage dedupe key는 없었다. 따라서 “이전에 같은 세션에서 보냈기 때문에 차단”은 이번 원인이 아니었다.
- 페이지 실행 문맥에서 전역 `parseInt`가 함수가 아닌 상태로 관측됐다. Custom HTML에서 bare `parseInt(...)`를 쓰면 일부 주문서 화면에서 스크립트가 중단될 수 있다.

판정:

- Codex Chrome Extension 두 개가 켜져 있던 것은 브라우저 제어에는 혼선을 줄 수 있지만, 이번 `begin_checkout` 미생성의 직접 원인으로 보기는 어렵다.
- 직접 원인은 `AGENTSOS` Custom HTML이 “태그 실행” 단계까지는 갔지만, 상품 파싱 또는 숫자 파싱에서 중단되어 `dataLayer.push({ event: "begin_checkout" })`까지 못 간 것이다.
- 보강 방향은 `Number(...)` 기반 숫자 파서, 상품 단위 dedupe key, text fallback, debug 경고를 포함한 v1.1 Custom HTML이다.

## gap 분해

### Gap A. 구매하기 버튼을 눌렀지만 주문서 화면까지 가지 않았다

의미: 상품 상세 URL이 계속 `/shop_view?...`이면 현재 GTM 기준으로 `begin_checkout`은 발화되지 않는다.
가능 원인:

- 옵션 선택이 아직 끝나지 않았다.
- 쿠폰/옵션/수량 UI가 중간 단계로 남아 있다.
- 구매하기 클릭이 바로 주문서 이동이 아니라 Imweb 내부 스크립트 처리로 끝난다.
- 새 창/iframe/모바일 레이어로 이동해 Tag Assistant가 같은 페이지 흐름으로 못 본다.

판정: 2026-05-18 Preview에서는 주문서 화면까지 이동했으므로 이번 케이스의 주원인에서는 제외한다. 다만 상품상세 버튼 클릭 자체를 별도 분석하려면 `checkout_intent` 또는 `buy_button_click` 선행지표가 여전히 필요하다.

### Gap B. 주문서 화면까지 갔지만 URL 조건이 맞지 않았다

의미: 실제 주문서 URL이 GTM trigger가 기대하는 `/shop_payment/` + 주문 key query 패턴과 다를 수 있다.
가능 원인:

- URL이 `/shop_payment`처럼 query 없이 열린다.
- 주문 key 이름이 GTM trigger가 기대하는 값과 다르다.
- 모바일/iframe/redirect가 다른 path를 쓴다.
- slash/query 정규식이 실제 URL과 다르다.

판정: 2026-05-18 Preview에서는 주문서 화면에 도착했고 주문서작성 dataLayer 태그도 Fired 되었으므로 이번 케이스에서는 가능성이 낮아졌다. 다만 모바일/다른 상품/다른 결제수단에서는 계속 확인 대상이다.

### Gap C. 주문서 URL은 맞지만 DOM/dataLayer 스크립트가 실패했다

의미: 주문서 화면은 열렸지만 `HURDLERS - [데이터레이어] 주문서작성`이 상품 DOM을 못 읽어 `begin_checkout` dataLayer push가 안 됐다.
가능 원인:

- `.shop_item_thumb`, `.shop_item_title`, `.shop_item_pay`, `.shop_item_opt` selector가 현재 Imweb DOM과 맞지 않는다.
- `quantity` 파싱 코드가 실패한다.
- 스크립트가 `window.addEventListener("load")` 이후 DOM 변경을 놓친다.
- 에러가 콘솔에만 찍히고 태그는 실패한다.

판정: 2026-05-18 03:19 Preview까지는 1순위 원인이었다. 기존 `.shop_item_*` selector가 현재 주문서 DOM과 맞지 않아 `begin_checkout`이 만들어지지 않았다. 2026-05-18 03:45 Preview에서 `[AGENTSOS]` 교체 초안 적용 후 `begin_checkout` dataLayer와 기존 GA4 이벤트 전송 태그 Fired가 확인되어, 이 gap은 Preview 기준 해소됐다.

## 2026-05-18 04:31 KST Preview 재검증 및 운영 게시

출처: TJ님 Tag Assistant Preview 재검증, GTM 운영 게시 결과. 대화와 문서에는 raw 주문/결제/member key를 남기지 않았다.

확인된 것:

- 첫 번째 상품 주문서 진입 후 `AGENTSOS - [begin_checkout] 주문서작성` Custom HTML이 1회 Fired 됐다.
- 같은 흐름에서 `HURDLES - [이벤트전송] 주문서작성` GA4 event tag도 1회 Fired 됐다.
- 두 번째 상품 주문서 진입 후 `AGENTSOS - [begin_checkout] 주문서작성`은 누적 2회, `HURDLES - [이벤트전송] 주문서작성`도 누적 2회로 확인됐다.
- `begin_checkout` dataLayer에는 `event_source=agentsos`, `agentsos_event_version=2026-05-18-agentsos-begin-checkout-v1`, `value`, `currency`, `items`가 들어왔다.
- 같은 payload에 `agentsos_ga4`, `hurdlers_ga4`, `ecommerce`를 함께 넣어 기존 GA4 event sender와 신규 AGENTSOS 구조가 모두 읽을 수 있게 했다.

중요 판단:

- `AGENTSOS - [begin_checkout] 주문서작성`과 `HURDLES - [이벤트전송] 주문서작성`이 둘 다 뜨는 것은 중복 오류가 아니다.
- `AGENTSOS`는 dataLayer에 `begin_checkout` 데이터를 만드는 태그다.
- `HURDLES`는 그 `begin_checkout` 이벤트를 받아 GA4로 보내는 기존 이벤트 전송 태그다.
- 따라서 지금은 `HURDLES` GA4 event sender를 삭제하면 안 된다. 이름은 나중에 `AGENTSOS - [이벤트전송] begin_checkout` 등으로 바꾸는 것이 맞다.

운영 게시:

- GTM container: `GTM-5M33GC4`
- Published version: `20`
- Version name: `AGENTSOS begin_checkout v1.1 - 2026-05-18`
- Published at: `2026-05-18 04:31 KST`
- Changed tag: `AGENTSOS - [begin_checkout] 주문서작성`
- 하지 않은 것: Purchase 전송, Meta CAPI 전송, VM Cloud 배포, 운영DB write, GTM 내 기존 GA4 sender 삭제.

남은 검증:

- GA4 DebugView/Realtime에서 `begin_checkout` 수신 확인.
- 다음 GA4 BigQuery daily export에서 `begin_checkout` 적재 확인.
- 기존 `HURDLES` 명칭은 추후 GTM 변경 승인 때 `AGENTSOS`로 rename한다.

### Gap D. dataLayer push는 됐지만 GA4 event 태그가 못 받았다

의미: `event=begin_checkout`은 생겼지만 `HURDLES - [이벤트전송] 주문서작성`이 Fired 되지 않았다.
가능 원인:

- custom event trigger 이름이 실제 event와 다르다.
- dataLayer push 시점이 GA4 tag 초기화보다 너무 빠르거나 늦다.
- blocking trigger나 iframe 조건이 예상과 다르다.

판정: 2026-05-18 04:26 Preview에서 두 상품 모두 `begin_checkout` dataLayer 생성과 `HURDLES - [이벤트전송] 주문서작성` Fired가 확인됐다. 2026-05-18 04:31 KST에 GTM version 20으로 운영 게시됐다. 따라서 이 gap은 GTM Preview/운영 게시 기준으로 해소됐다. 남은 확인은 GA4 DebugView/Realtime과 다음 BigQuery export 적재다.

### Gap E. GA4까지 보냈지만 BigQuery에 아직 없다

의미: GA4 Debug/Realtime에는 보이는데 BigQuery export에는 아직 안 들어온 상태다.
가능성: 낮음. export 전체 기간에서 0이므로 단순 지연보다는 runtime trigger gap 가능성이 더 높다.

## 개발 판단

현재는 `begin_checkout`을 상품 상세 구매하기 버튼 클릭으로 바꾸지 않는 편이 맞다. 이유는 구매하기 버튼 클릭만으로는 실제 주문서 작성이 시작됐는지 불명확하기 때문이다.

권장 구조:

1. 상품 상세 구매하기 버튼 클릭: `checkout_intent` 또는 `buy_button_click`
2. 주문서 화면 진입 + 상품 DOM 확인: `begin_checkout`
3. 결제수단 선택/NPay 클릭: `add_payment_info` 또는 `payment_method_selected`
4. 결제완료 원장 확인: `purchase`

이렇게 나누면 “구매하려고 눌렀다”와 “실제로 주문서를 작성하기 시작했다”를 구분할 수 있다.

## Preview-only 확인 절차

1. 상품 상세에서 구매하기 버튼을 누른다.
   성공 기준: Tag Assistant 좌측 이벤트 흐름에서 URL이 `/shop_view`에 머무는지, `/shop_payment`로 이동하는지 확인한다.
   실패 시 다음 확인점: 옵션/쿠폰/로그인/새 창/iframe 중 어디서 멈췄는지 기록한다.

2. `/shop_payment` 화면이 열렸다면 `HURDLERS - [데이터레이어] 주문서작성` 태그를 확인한다.
   성공 기준: Fired이고 Data Layer에 `event=begin_checkout`이 보인다.
   실패 시 다음 확인점: Not Fired면 URL/DOM trigger 문제, Fired but error면 selector/parser 문제다.

3. Data Layer에 `begin_checkout`이 있다면 GA4 이벤트 전송 태그를 확인한다.
   성공 기준: `HURDLES - [이벤트전송] 주문서작성` Fired.
   실패 시 다음 확인점: custom event trigger 이름과 blocking condition.

4. NPay/결제수단 클릭 단계는 `add_payment_info`와 분리한다.
   성공 기준: 결제수단 선택은 purchase가 아니라 결제수단 이벤트로만 남는다.

## 패치 후보

1. `checkout_intent` 추가
   무엇: 상품 상세 구매하기 버튼 클릭을 별도 선행지표로 기록한다.
   왜: `begin_checkout`까지 도달하지 못한 이탈을 분해하기 위해서다.
   어떻게: GTM click trigger 또는 VM Cloud site script로 버튼 클릭을 1회 dedupe 기록한다.
   검증: 상품 상세 버튼 클릭 1회당 `checkout_intent` 1회, purchase 0.

2. `begin_checkout` URL trigger 보강
   무엇: 실제 주문서 URL 패턴에 맞게 trigger 조건을 넓힌다.
   왜: 주문서에 도착했는데도 0이면 퍼널의 핵심 중간 단계가 비어 있기 때문이다.
   어떻게: Preview에서 실제 URL을 확인한 뒤 `/shop_payment` path + order key presence 조건으로 수정한다.
   검증: 주문서 화면에서 dataLayer `begin_checkout`과 GA4 `begin_checkout`이 모두 Fired.

3. 주문서 DOM selector 보강
   무엇: 현재 `.shop_item_*` selector가 깨졌는지 확인하고 안정 selector로 바꾼다.
   왜: 주문서 화면 구조가 바뀌면 dataLayer push가 실패하기 때문이다.
   어떻게: `#oms-shop-payment`를 주문서 루트로 잡고, 텍스트/DOM fallback으로 상품명·금액·수량을 읽는다. selector가 없을 때는 스크립트 전체가 죽지 않게 null guard를 넣는다.
   검증: item_count > 0, currency=KRW, items present, Tag Assistant 좌측에 `begin_checkout` custom event 1회.

4. 주문서 숫자 파서 보강
   무엇: Custom HTML 안에서 bare `parseInt(...)`를 쓰지 않는다.
   왜: 실제 주문서 페이지에서 전역 `parseInt`가 함수가 아닌 상태가 관측되어 스크립트가 중단될 수 있기 때문이다.
   어떻게: `Number(String(value).replace(...))` 방식으로 금액/수량을 파싱하고, 실패하면 0 또는 1로 안전하게 fallback한다.
   검증: 다른 상품 주문서에서도 `AGENTSOS` 태그 Fired 후 `begin_checkout` custom event가 생성된다.

5. 주문서작성 Custom HTML 실행 시점 보강
   무엇: `window.load`에만 의존하지 않고, 태그 실행 직후 DOM을 읽고 실패하면 짧게 재시도한다.
   왜: GTM 태그가 load 이후에 실행되면 현재 코드의 callback이 다시 실행되지 않을 수 있기 때문이다.
   어떻게: `runBeginCheckout()` 함수를 만들고 즉시 실행 + 300ms/1000ms 재시도, 성공 시 sessionStorage dedupe를 건다.
   검증: 주문서 화면에서 Data Layer `begin_checkout` 1회, GA4 `HURDLES - [이벤트전송] 주문서작성` 1회.

## 100% 조건

- 상품 상세 버튼 클릭과 주문서 작성 시작이 별도 이벤트로 분리된다.
- `begin_checkout`은 주문서 화면에서만 발생한다.
- GA4 BigQuery에 `begin_checkout`이 24~48시간 내 적재된다.
- VM Cloud 퍼널에서 site=thecleancoffee 기준으로 `checkout_intent`, `begin_checkout`, `purchase`가 분리된다.
- `begin_checkout`/`add_payment_info`는 purchase 후보가 아니다.
- raw order/payment/member/click id 출력 0.
