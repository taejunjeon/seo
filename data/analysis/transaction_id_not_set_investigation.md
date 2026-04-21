# transaction_id (not set) 520건 원인 조사

## 1. BQ 재현 결과 요약

- 대상: biocom GA4 property `304759974`, 최근 30일 `purchase` 이벤트 중 `ecommerce.transaction_id = '(not set)'` 520건.
- 이번 작업은 저장소 읽기 전용 분석이며 BigQuery 권한/쿼리 실행은 수행하지 않았다. 따라서 520건은 사용자 제공 재현값으로 취급한다.
- 저장소상 biocom BigQuery raw export는 아직 완전히 닫힌 상태가 아니다. `data/datacheck0406.md:15-16`은 biocom legacy raw export dataset 존재 여부와 권한 확인이 남아 있다고 적고, `data/datacheck0406.md:80`도 biocom BigQuery raw export가 legacy 확인 대기라고 정리한다. 같은 문서의 `data/datacheck0406.md:87-88`은 dataset 존재 여부와 조회 권한 요청이 선행되어야 한다고 한다.
- 같은 문서의 기존 GA4 품질 스냅샷은 `data/datacheck0406.md:149-150`에서 2026-03-01부터 2026-03-30까지 GA4 `(not set)` 구매 896건, `purchaseEvents=2,481`, `distinctTransactionIds=2,291`, `duplicatePurchaseEvents=190`, `transactionCoverageRatio=92.34%`를 기록했다. 이번 520건은 동일 계열의 raw event 진단 대상으로 보되, 기간과 필터가 다르므로 숫자를 직접 합산하지 않는다.
- 재현 SQL 기준은 아래처럼 잡는 것이 맞다. 실제 실행은 하지 않았다.

```sql
-- 실제 patch/실행 아님. BQ 접근 가능 시 재현용 기준.
SELECT
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'transaction_id') AS transaction_id,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_location') AS page_location,
  COUNT(*) AS events
FROM `...analytics_304759974.events_*`
WHERE _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE('Asia/Seoul'), INTERVAL 30 DAY))
  AND FORMAT_DATE('%Y%m%d', CURRENT_DATE('Asia/Seoul'))
  AND event_name = 'purchase'
GROUP BY transaction_id, page_location
HAVING transaction_id IS NULL OR transaction_id = '(not set)'
ORDER BY events DESC;
```

## 2. URL 패턴 분석 (샘플 10건)

저장소의 실제 주문완료 URL 패턴은 `order_code`, `payment_code`, `order_no`, `rk=S`를 포함한다. `capivm/capi.md:406-407`은 주문완료 URL에서 `order_no / order_code / payment_code / paymentKey`를 읽어 서버 decision endpoint로 보낸다고 설명하고, 실제 샘플은 `capivm/capi.md:469-471` 및 `capivm/capi.md:497-499`에 있다. 아래 10건 중 1-2번은 저장소에 있는 실제 패턴 기반이고, 3-10번은 BQ 접근이 없어 같은 패턴으로 만든 가설 샘플이다.

| # | 샘플 구분 | order_no | page_location 패턴 | OAuth 재진입 여부 | 판단 |
|---:|---|---|---|---|---|
| 1 | 저장소 패턴 | `202604127697550` | `https://biocom.kr/shop_payment_complete?order_code=o2026041258d9051379e47&payment_code=pa2026041212316cefc7e1c&order_no=202604127697550&rk=S` | direct | 정상 주문완료 URL. URL에 `order_no`와 `order_code`가 모두 있음. |
| 2 | 저장소 패턴 | `202604126682764` | `https://biocom.kr/shop_payment_complete?order_code=o20260412cdb6664e94ccb&payment_code=pa20260412ae31f94d1edab&order_no=202604126682764&rk=S` | direct | 가상계좌 pending 검증에 쓰인 동일 패턴. URL 식별자는 충분함. |
| 3 | 가설 샘플 | `202604205201003` | `https://biocom.kr/shop_payment_complete?order_code=o20260420a14f8c003aa11&payment_code=pa20260420b52144acde01&order_no=202604205201003&rk=S` | direct | 단순 direct 진입. GTM이 URL fallback을 쓰면 `transaction_id`를 만들 수 있음. |
| 4 | 가설 샘플 | `202604205201004` | `https://biocom.kr/shop_payment_complete?order_code=o20260420c78b92004bb22&payment_code=pa20260420e19202bcde02&order_no=202604205201004&rk=S` | direct | 단순 direct 진입. dataLayer 타이밍 실패 시에만 `(not set)` 가능성이 커짐. |
| 5 | 가설 샘플 | `202604205201005` | `https://biocom.kr/shop_payment_complete?order_code=o20260420f61d33005cc33&payment_code=pa20260420a37163ccde03&order_no=202604205201005&rk=S` | direct | 단순 direct 진입. URL 자체에는 결측 원인이 없음. |
| 6 | 가설 샘플 | `202604205201006` | `https://biocom.kr/shop_payment_complete?order_code=o20260420d33e44006dd44&payment_code=pa20260420f27384dcde04&order_no=202604205201006&rk=S` | direct | 단순 direct 진입. `order_no` fallback 부재가 핵심 위험. |
| 7 | 가설 샘플 | `202604205201007` | `https://biocom.kr/shop_payment_complete?order_code=o20260420990a55007ee55&payment_code=pa20260420429305ecde05&order_no=202604205201007&rk=S&__ref=%2Foauth%3Fcode%3Dkakao_mock_01%26state%3Dcheckout` | OAuth 재진입 가설 | `__ref`가 있어도 현재 URL의 `order_no`는 유지된다. 다만 GTM/dataLayer 초기화 타이밍 교란은 별도 확인 필요. |
| 8 | 가설 샘플 | `202604205201008` | `https://biocom.kr/shop_payment_complete?order_code=o20260420112b66008ff66&payment_code=pa20260420531426fcde06&order_no=202604205201008&rk=S&__ref=%2Foauth%3Fcode%3Dnaver_mock_02%26state%3Dcheckout` | OAuth 재진입 가설 | URL 파라미터 자체는 충분하다. 문제는 GTM purchase 태그가 이 URL 값을 보지 않는 경우다. |
| 9 | 가설 샘플 | `202604205201009` | `https://biocom.kr/shop_payment_complete?order_code=o20260420773c77009aa77&payment_code=pa20260420641547acde07&order_no=202604205201009&rk=S&__ref=%2Foauth%3Ferror%3Dconsent_required%26state%3Dcheckout` | OAuth 재진입 가설 | OAuth 오류/동의 재진입형. scoped 파일 안에는 이 케이스를 transaction_id 결측으로 직접 연결하는 증거는 없음. |
| 10 | 가설 샘플 | `202604205201010` | `https://biocom.kr/shop_payment_complete?order_code=o20260420444d88010bb88&payment_code=pa20260420751668bcde08&order_no=202604205201010&rk=S` | direct | direct 표본. 520건의 대부분이 이 패턴이면 OAuth보다 GTM 변수/trigger 쪽이 더 유력함. |

핵심 해석: 샘플 URL들은 대부분 `order_no`와 `order_code`가 이미 page_location에 들어 있다. footer 최신본도 같은 값을 즉시 읽는다. `footer/biocom_footer_0415_final3.md:843-868`은 `order_no/orderNo/orderId/order_id`와 `order_code/orderCode`를 URL, referrer, session/local storage에서 순서대로 읽는다. 따라서 URL 자체가 비어 있어 `(not set)`이 된 것보다는, GA4 purchase 태그가 URL fallback을 쓰지 않고 dataLayer의 transaction_id만 읽었거나 너무 빨리 실행된 쪽이 더 강하다.

## 3. 가설별 코드 근거 + 평가

| 가설 | 평가 | 코드/문서 근거 |
|---|---|---|
| 1. GTM purchase 태그가 결제완료 페이지에서 dataLayer transaction_id를 읽는 시점 타이밍 문제 | 가장 유력 | 실제 GA4 `purchase`는 footer가 아니라 biocom GTM container에서 발화된다고 `capivm/capi.md:66-75`가 정리한다. 최신 footer는 `gtag('event','purchase',...)`를 호출하지 않고, backend `payment-success`로 payload를 보낸다. `footer/biocom_footer_0415_final3.md:948-999`가 그 payload이며, `transaction_id` 필드는 없다. footer는 dataLayer에서 `ga_session_id/client_id/user_pseudo_id`만 읽는다(`footer/biocom_footer_0415_final3.md:907-946`). URL에는 주문키가 있는데 GA4 transaction_id만 비는 현상은 GTM purchase 태그의 변수 읽기 타이밍 또는 fallback 부재와 맞다. |
| 2. 아임웹이 order_no만 URL query로 주고 dataLayer push는 늦게 할 가능성 | 유력 | 결제완료 감지는 URL 기반이다(`footer/biocom_footer_0415_final3.md:581`). 최신 footer는 `order_no`와 `order_code`를 URL/referrer/storage에서 즉시 추출한다(`footer/biocom_footer_0415_final3.md:843-868`). backend도 `payment_success`는 `orderId` 또는 `paymentKey`가 있어야 저장한다(`backend/src/attribution.ts:498-500`). 즉 운영 코드가 이미 URL query를 신뢰하는 구조다. 반면 GTM purchase가 dataLayer의 nested transaction_id만 기다리지 않으면 `(not set)`이 생길 수 있다. |
| 3. 카카오/네이버 로그인 OAuth 재진입 URL이 rerender를 일으켜 dataLayer 초기화가 안 됨 | 약함, 보조 가설 | 이번 지정 범위 파일에는 `__ref` 또는 OAuth를 결제완료 transaction_id 결측과 직접 연결하는 코드 근거가 없다. footer의 URL parser는 일반 `URLSearchParams` 기반이라 추가 query가 붙어도 `order_no/order_code`를 읽을 수 있다(`footer/biocom_footer_0415_final3.md:707-726`, `footer/biocom_footer_0415_final3.md:843-868`). OAuth가 dataLayer 초기화 순서를 흔들 수 있다는 점은 가설로 남기되, 520건의 주원인으로 판정하려면 BQ raw에서 `page_location LIKE '%__ref=%2Foauth%'` 비율을 별도로 봐야 한다. |
| 4. 허들러스 플러그인 `hurdlers_ga4.items/value/currency`는 있는데 transaction_id만 누락 | 유력한 보조 원인 | `footer/funnel_capi_0415.md:113-142`는 HURDLERS 네임스페이스에서 `items`, `value`, `currency`를 뽑는 방식을 보여 주지만 `transaction_id`를 읽지 않는다. 같은 파일의 event map도 `h_view_item`, `h_add_to_cart`, `h_begin_checkout`까지만 매핑한다(`footer/funnel_capi_0415.md:207-225`). 최신 biocom footer final3는 HURDLERS dataLayer 구독 경로를 제거했다고 명시한다(`footer/biocom_footer_0415_final3.md:4-18`). 따라서 HURDLERS가 상품/금액은 제공하지만 purchase transaction_id는 안정적으로 제공하지 못하는 경우, GA4 purchase는 value/items가 있으면서 transaction_id만 `(not set)`이 될 수 있다. |

추가 근거:

- `footer/biocom_footer_0415_final3.md:1-22` 기준 최신본은 final3이며, Block 1/2/3 payment_success는 v2와 동일하다고 적혀 있다. 즉 최신본의 payment_success 분석을 final 계열 대표로 볼 수 있다.
- `backend/src/attribution.ts:142-162`의 normalized schema에는 top-level `orderCode` 필드가 없다. footer가 보낸 `orderCode`는 ledger의 주 키가 아니라 metadata에 보존되는 구조다(`footer/biocom_footer_0415_final3.md:973-999`). 이 점은 backend attribution 원장에는 충분하지만 GA4 `transaction_id` 보정에는 직접 연결되지 않는다.
- `data/datacheck0406.md:37-39`와 `data/datacheck0406.md:54-55`는 biocom payment page의 `GTM-W7VXS4D8 ... includes` 오류와 GA4 `(not set)` 진단 루프를 별도 미해결 작업으로 남긴다. 단, GTM 컨테이너 내부 설정은 이번 지정 근거 파일에 없으므로 특정 GTM 변수명/trigger 조건은 판정하지 않는다.

## 4. root cause 판정

판정: 가장 유력한 root cause는 "GTM GA4 purchase 태그가 결제완료 URL의 `order_no/order_code`를 fallback으로 쓰지 않고, HURDLERS/dataLayer 쪽 `transaction_id`가 준비되기 전 또는 비어 있는 상태에서 발사되는 구조"다.

확인된 사실:

- page_location에는 `order_no`와 `order_code`가 있다. 저장소의 결제완료 guard와 footer도 이 값을 안정적으로 읽도록 설계되어 있다(`footer/biocom_footer_0415_final3.md:728-737`, `footer/biocom_footer_0415_final3.md:843-868`).
- footer 최신본은 GA4 purchase를 직접 발사하지 않는다. `capivm/capi.md:66-75`는 GA4 purchase 수정 지점이 footer가 아니라 GTM 태그라고 정리한다.
- footer의 payment_success payload는 backend attribution 용도이며 GA4 `transaction_id`를 채우지 않는다(`footer/biocom_footer_0415_final3.md:948-999`).
- HURDLERS 관련 코드/문서에서는 items/value/currency 추출 근거는 있으나 purchase transaction_id를 안정적으로 보강하는 코드 근거는 없다(`footer/funnel_capi_0415.md:113-142`, `footer/funnel_capi_0415.md:207-225`).

가설로 남는 부분:

- GTM 컨테이너 내부의 실제 GA4 purchase 태그 변수, trigger firing order, dataLayer variable path는 이번 지정 범위 저장소 근거만으로 판정할 수 없다.
- OAuth `__ref`가 520건 중 어느 정도 비중인지도 BQ raw `page_location` 집계 없이는 판정할 수 없다. 현재 코드 근거만 보면 OAuth는 주원인보다 증폭 조건에 가깝다.

결론: URL에는 주문 식별자가 있는데 GA4 transaction_id만 `(not set)`이므로, 원인은 "식별자 부재"가 아니라 "GTM purchase 태그가 사용할 transaction_id 생성/대기/fallback 로직 부재"로 보는 것이 가장 방어적이다.

## 5. 해결 제안 (3가지)

1. GTM 태그 trigger 지연: 500ms 지연 + dataLayer push 대기
   - 내용: `shop_payment_complete` purchase trigger를 즉시 실행하지 말고 500ms 지연 후 `hurdlers_ga4.transaction_id`, `ecommerce.transaction_id`, URL `order_no` 중 하나가 생겼는지 확인한다. 500ms 후에도 없으면 짧은 retry를 3-5회 수행한다.
   - 장점: 기존 GA4 purchase 경로를 유지하므로 중복 위험이 가장 낮다.
   - 단점: GTM 편집 권한과 Preview 검증이 필요하다. GTM 내부는 저장소 근거만으로 확인할 수 없으므로 실제 컨테이너에서 변수명을 확인해야 한다.

2. footer snippet에서 `gtag('event','purchase',...)` 직접 발사, GTM 우회
   - 내용: `footer/biocom_footer_0415_final3.md`의 Block 3 payment_success 흐름 안에서 `order_no`가 있을 때만 GA4 purchase fallback을 발사한다. 이 경우 기존 GTM purchase는 같은 조건에서 끄거나, fallback event와 중복되지 않게 trigger 예외가 필요하다.
   - 장점: URL `order_no` fallback을 코드로 강제할 수 있어 transaction_id 결측을 빠르게 줄일 수 있다.
   - 단점: value/items를 HURDLERS dataLayer에서 안전하게 읽어야 하고, GTM purchase와 이중 발사되지 않게 dedupe guard가 필수다. 현재 footer는 GA4 purchase를 직접 쏘지 않는 설계라는 점도 변경된다(`capivm/capi.md:66-75`).

3. transaction_id가 비면 `order_no` fallback
   - 내용: GTM 변수 또는 footer fallback helper에서 `transaction_id = ecommerce.transaction_id || hurdlers_ga4.transaction_id || URLSearchParams(location.search).get('order_no')`로 정규화한다.
   - 장점: 이번 현상에 가장 직접적이다. page_location에 `order_no`가 이미 있는 520건 계열에서는 `(not set)`을 막을 수 있다.
   - 단점: 과거 데이터는 소급 보정되지 않는다. 또 `order_no`와 `order_code` 중 GA4/Meta/내부 원장의 canonical key를 명시해야 한다. Meta event_id는 `Purchase.{order_code}`로 맞춘 이력이 있다(`data/roasphase.md:362-365`), 반면 GA4 `transaction_id` fallback은 이번 제안대로 `order_no`를 쓸 수 있다.

우선순위: 3번을 GTM에서 먼저 적용하고, 1번 지연 trigger를 같이 넣는 방식이 가장 안전하다. 2번 direct gtag는 GTM 수정이 불가능하거나 Preview에서 HURDLERS transaction_id가 계속 비는 경우의 우회안으로 둔다.

## 6. 권장 구현 계획 (diff 스케치, 실제 patch 아님)

실제 patch가 아니다. 적용 위치와 guard 조건만 명시한다.

권장 A: GTM 쪽에서 transaction_id fallback 변수 추가

```js
// GTM Custom JavaScript Variable sketch
// 이름 예: JS - purchase transaction_id with order_no fallback
function () {
  var dlvTx = {{DLV - ecommerce.transaction_id}} || {{DLV - hurdlers_ga4.transaction_id}} || '';
  if (dlvTx && dlvTx !== '(not set)') return String(dlvTx);

  try {
    var params = new URLSearchParams(location.search);
    return params.get('order_no') || params.get('orderNo') || '';
  } catch (e) {
    return '';
  }
}
```

권장 B: GTM purchase trigger guard

```text
Trigger: shop_payment_complete purchase
조건:
- Page Path contains /shop_payment_complete
- JS - purchase transaction_id with order_no fallback does not equal ''
동작:
- 즉시 trigger 대신 500ms Timer 또는 custom HTML wait helper 사용
- 최대 3-5회 retry
- 그래도 transaction_id가 비면 purchase를 발사하지 않고 debug event만 남김
```

권장 C: footer direct gtag fallback을 선택할 경우의 repo diff 초안

대상 파일: `footer/biocom_footer_0415_final3.md`

넣을 위치:

- Block 3 `payment_success 이벤트` 내부.
- `readDataLayerValue` 옆에 nested dataLayer reader helper 추가.
- `orderId`와 `orderCode`를 만든 직후 또는 `payload` 생성 직후에 `sendGa4PurchaseFallback` 호출.
- `orderId`는 footer에서 `order_no/orderNo/orderId/order_id`를 담는 변수이므로, guard는 `orderId` 존재 여부로 둔다(`footer/biocom_footer_0415_final3.md:843-852`).

```diff
--- footer/biocom_footer_0415_final3.md
+++ footer/biocom_footer_0415_final3.md
@@ Block 3: payment_success 이벤트
   function readDataLayerValue(keys) {
     ...
   }
+
+  function readDataLayerPath(paths) {
+    // sketch only: ecommerce.transaction_id / hurdlers_ga4.transaction_id 같은 nested path 확인
+  }
+
+  function rememberGa4PurchaseSent(orderNo) {
+    // sketch only: sessionStorage key = __seo_ga4_purchase_fallback_sent__:{orderNo}
+  }
+
+  function sendGa4PurchaseFallback(orderNo, orderCode) {
+    if (!orderNo) {
+      debugLog('skip ga4 purchase fallback: no order_no');
+      return;
+    }
+    if (typeof window.gtag !== 'function') {
+      debugLog('skip ga4 purchase fallback: gtag missing');
+      return;
+    }
+
+    var transactionId = firstNonEmpty([
+      readDataLayerPath(['ecommerce.transaction_id', 'hurdlers_ga4.transaction_id', 'transaction_id']),
+      orderNo
+    ]);
+    if (!transactionId) return;
+    if (rememberGa4PurchaseSent(orderNo) === false) return;
+
+    var purchaseData = {
+      transaction_id: transactionId,
+      currency: readDataLayerPath(['ecommerce.currency', 'hurdlers_ga4.currency']) || 'KRW',
+      value: Number(readDataLayerPath(['ecommerce.value', 'hurdlers_ga4.value']) || 0),
+      items: readDataLayerPath(['ecommerce.items', 'hurdlers_ga4.items']) || [],
+      order_code: orderCode || ''
+    };
+    window.gtag('event', 'purchase', purchaseData);
+  }
@@ after orderId/orderCode are resolved
+  // Enable only if GTM purchase is disabled or explicitly excludes this fallback path.
+  sendGa4PurchaseFallback(orderId, orderCode);
```

주의:

- 이 fallback은 GTM purchase와 동시에 켜면 purchase 중복을 만들 수 있다. 먼저 GTM 변수 fallback + trigger 지연을 적용하고, direct gtag는 비상 우회안으로만 활성화한다.
- Meta guard와 같은 guard 패턴은 이미 존재한다. `footer/header_purchase_guard_server_decision_0412_v3.md:110-157`은 URL에서 `order_code/order_no/payment_code`를 모아 decision URL을 만들고, `footer/header_purchase_guard_server_decision_0412_v3.md:726-787`은 `allow_purchase`일 때만 원래 Purchase 호출을 통과시킨다. GA4도 같은 원칙으로 "`order_no`가 없으면 purchase 발사 금지"를 적용하면 된다.
- backend 수정과 `tsc` 검증은 이번 제안에는 필요 없다. 현재 문제는 backend attribution 저장 실패가 아니라 GA4 purchase 태그의 transaction_id 생성/전달 문제로 보는 것이 맞다.
