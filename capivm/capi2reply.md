# Meta Purchase 정합성 개발 결과 - 2026-04-11

## 바로 결론

`capivm/capireply.md`의 지적을 반영해 계획을 수정했고, 로컬 백엔드에서 바로 할 수 있는 CAPI payload 안정화 작업을 진행했다.

이번에 실제 개발까지 반영한 것은 다음이다.

- `Purchase event_id`를 Browser Pixel의 Imweb 주문코드 규칙과 맞추도록 변경.
- Server CAPI `event_source_url`을 절대 URL로 정규화.
- metadata에 상품 정보가 들어오는 경우 Server CAPI `content_ids`, `contents`를 자동 반영하도록 준비.
- 테스트를 갱신하고 백엔드 타입체크/attribution 테스트를 통과시킴.

아직 끝나지 않은 핵심은 두 가지다.

- 가상계좌 미입금 주문의 Browser Pixel `Purchase` 차단.
- Meta Events Manager Test Events에서 Browser Purchase와 Server CAPI Purchase의 `event_id` 일치 재확인.

이 두 가지는 Meta/아임웹 화면 또는 실제 confirmed 테스트 주문이 필요하다. VM 이전은 이 확인 이후가 맞다.

## 수정한 계획

수정 파일:

- `capivm/capi.md`

반영 내용:

- 제목을 `CAPI Purchase 정합성`에서 `Meta Purchase 정합성`으로 바꿨다. 현재 문제는 Server CAPI만이 아니라 Browser Pixel Purchase 정의까지 포함하기 때문이다.
- 완료 기준을 강화했다. “가상계좌 미입금 주문은 Purchase로 잡히지 않게 하거나 별도 위험으로 분리”가 아니라, **가상계좌 미입금 주문에서는 Browser Pixel Purchase가 발화하지 않는 것**을 완료 기준으로 적었다.
- 즉시 차단이 어렵다면 `pending_purchase_leakage`로 별도 집계할 수는 있지만, 그 상태는 완료로 보지 않는다고 명시했다.
- 최초 계획은 `Purchase event_id = purchase:{orderId}`였으나, 실제 Imweb Browser Pixel이 `Purchase.{orderCode}`를 쓰는 것이 확인되어 서버 CAPI도 같은 값으로 맞추는 방향으로 수정했다.
- 정합성 수정과 VM 준비를 2트랙으로 분리했다. VM 준비는 병행하되, 컷오버는 `pending Purchase 차단 + confirmed 주문 dedup 확인` 이후에 한다.
- 증거 수집원을 분리했다. Browser는 Pixel Helper/Network 탭, Server는 CAPI log/JSONL/Test Events로 본다.
- 광고 학습용 이벤트와 매출 측정용 이벤트를 분리한다고 적었다. ROAS 리포팅은 confirmed `Purchase`, 저볼륨 학습용 후보는 `AddPaymentInfo` 또는 `VirtualAccountIssued`다.

## 개발 반영 내용

수정 파일:

- `backend/src/metaCapi.ts`
- `backend/tests/attribution.test.ts`

### 1. event_id 규칙 변경

기존:

```text
{orderId}_{eventName}_{approvedAt timestamp}
```

변경:

```text
Purchase.{orderCode}
```

예시:

```text
Purchase.o202604111e6d6e78c02e9
add_payment_info:202604110037075
```

Browser Pixel Helper에서 실제 카드 결제 완료 주문 `202604110037075`의 Purchase Event ID가 `Purchase.o202604111e6d6e78c02e9`로 확인됐다. 이 값의 `o202604111e6d6e78c02e9`는 아임웹 `order_code`이고, 우리 내부 주문번호 `202604110037075`와 다르다.

서버 CAPI는 이제 Purchase 이벤트에서 다음 순서로 Event ID를 만든다.

- `metadata.referrerPayment.orderCode` 또는 `metadata.orderCode`가 있으면 `Purchase.{orderCode}` 사용.
- 없으면 `landing/referrer` URL의 `order_code` 또는 `orderCode` 파라미터를 사용.
- 그래도 없으면 기존 fallback인 `{eventName}:{orderId}` 사용.

`202604083892378-P1`처럼 상품/라인 suffix가 붙은 주문 ID는 fallback에서 `202604083892378`로 정규화한다.

이유:

- 같은 주문의 같은 Purchase는 Browser, Server, retry 모두 같은 `event_id`를 써야 Meta dedup이 가능하다.
- Browser Pixel이 이미 `Purchase.{orderCode}`를 쓰고 있으므로 서버 CAPI가 `purchase:{orderId}`를 쓰면 같은 카드 결제도 중복으로 잡힐 수 있다.
- 승인시각이나 loggedAt을 event_id에 넣으면 브라우저와 서버가 같은 값을 만들기 어렵다.
- 같은 주문을 재전송할 때 timestamp 차이로 event_id가 갈라질 위험을 없애야 한다.

주의:

- 기존 CAPI 로그의 event_id는 과거 형식 그대로 남는다.
- 이번 변경은 이후 생성되는 CAPI 전송부터 적용된다.
- 기존 주문 재전송은 `orderId/paymentKey + eventName` 성공 전송 이력으로 계속 차단된다.

2026-04-11 23:46 KST 카드 결제 테스트 주문 확인:

- 주문번호: `202604110037075`
- 아임웹 order_code: `o202604111e6d6e78c02e9`
- Browser Pixel Purchase Event ID: `Purchase.o202604111e6d6e78c02e9`
- 로컬 원장 상태: `confirmed`
- 승인시각: `2026-04-11T14:46:26.000Z`
- 결제수단: `카드`
- Toss 상태: `DONE`
- 상태 보정 경로: `toss_direct_api_fallback`
- 서버 CAPI 신규 생성 Event ID 검증값: `Purchase.o202604111e6d6e78c02e9`

2026-04-12 00:05 KST 서버 CAPI Test Events 수동 전송 결과:

- 호출 목적: 카드 결제 완료 주문 1건의 Browser/Server dedup 검증.
- 사용 Test Event Code: `TEST95631`
- 호출 주문번호: `202604110037075`
- 호출 결과: 성공.
- Meta 응답: `events_received=1`, HTTP `200`.
- Server CAPI event_id: `Purchase.o202604111e6d6e78c02e9`
- Pixel ID: `1283400029487161`
- event_source_url: `https://biocom.kr/shop_payment/?order_code=o202604111e6d6e78c02e9&order_no=202604110037075&order_member=m20190715a72570943315e`
- value: `39000`
- currency: 코드상 `KRW`
- custom_data.order_id: 코드상 `202604110037075`
- send_path: `test_event`
- fbtrace_id: `AA_LXmsfMdiAkQBKt3vBqoi`

추가 확인:

- 이 주문은 수동 Test Event 전송 전에도 운영 auto-sync로 2026-04-11 23:58:45 KST에 이미 1회 전송됐다.
- 운영 auto-sync의 event_id도 `Purchase.o202604111e6d6e78c02e9`로 동일하다.
- 따라서 서버 쪽 신규 event_id 생성 규칙은 운영/테스트 모두 Browser Pixel에서 확인한 Event ID와 일치한다.
- 남은 확인은 Meta Test Events 화면에서 Browser Purchase와 Server Purchase를 열어 실제 화면상 `event_id`, `order_id`, `event_source_url`, `value`, `currency`, 가능하면 `content_ids/contents/content_type`이 어떻게 보이는지 확인하는 것이다.

### 2. event_source_url 절대 URL 정규화

기존에는 `landing`이 상대경로이면 상대경로가 그대로 들어갈 수 있었다.

변경 후:

- 이미 `https://...`이면 그대로 사용.
- `//...`이면 `https:`를 붙여 정규화.
- `/path` 또는 `path`이면 source 기준 도메인을 붙인다.
- biocom 기본값은 `https://biocom.kr`.
- thecleancoffee 기본값은 `https://thecleancoffee.com`.
- aibio 기본값은 `https://aibio.ai`.

이유:

- Meta Server CAPI의 `event_source_url`은 절대 URL이 안정적이다.
- Meta 샘플 CSV에서 Server 이벤트의 URL 품질이 흔들렸기 때문에 먼저 줄일 수 있는 문제부터 줄였다.

### 3. content_ids / contents 자동 반영 준비

Server CAPI custom_data 타입에 아래 필드를 추가했다.

```text
content_ids?: string[]
contents?: [{ id, quantity?, item_price? }]
```

metadata에서 다음 키가 들어오면 자동으로 반영한다.

```text
content_id, contentId, content_ids, contentIds,
product_id, productId, product_ids, productIds,
product_no, productNo,
item_id, itemId,
contents, items, products, orderItems, orderProducts
```

현재 원장에는 상품 ID가 안정적으로 없기 때문에, 이 변경은 “지금 즉시 100% 채움”이 아니라 “상품 정보가 들어오기 시작하면 서버 CAPI가 바로 싣도록 준비”한 것이다.

## 상품 ID가 현재 원장 metadata에 없는 이유

로컬 SQLite 기준으로 확인했다.

분석 쿼리 결과:

```text
payment_success rows: 741
rows with any product/content key: 0
rows with referrer orderId -P suffix: 652
```

확인한 상품 관련 metadata key:

```text
content_id, contentId, content_ids, contentIds,
product_id, productId, product_ids, productIds,
product_no, productNo,
item_id, itemId,
items, products, contents, orderItems, orderProducts
```

전부 0건이었다.

원인:

- 현재 footer/payment_success 스니펫은 주문번호, 결제키, UTM, GA 식별자, `_fbc`, `_fbp`, checkout context 중심으로 수집한다.
- 상품 line item이나 상품 ID를 읽어서 payload에 넣는 로직은 없다.
- 결제완료 URL/referrer에는 `orderId=202604...-P1` 같은 값이 자주 보이지만, 이것은 상품 ID가 아니라 주문 line suffix에 가깝다. Meta `content_ids`로 쓰면 안 된다.
- Toss Payments API 응답은 결제상태, 승인시각, 금액, 고객 연락처 중심이고 상품 line item을 주지 않는다.
- 로컬 `imweb_orders` 테이블도 현재는 order-level schema다. `raw_json` 샘플에도 상품 line item이 안정적으로 들어있지 않았고, 별도 order item 테이블도 확인되지 않았다.
- Browser Pixel은 아임웹/Meta/GTM 쪽 구매 태그가 브라우저 화면의 상품 context를 갖고 있어 `content_ids=["97"]`를 보낼 수 있지만, 우리 Server CAPI 경로는 그 값을 아직 전달받지 못한다.

따라서 Server CAPI의 `content_ids/contents`를 제대로 채우려면 아래 중 하나가 필요하다.

- 결제완료 footer에서 `hurdlers_ga4.items` 또는 아임웹 dataLayer 상품 배열을 읽어 `payment-success` payload에 포함.
- 아임웹 주문 상세 API에서 주문번호별 line item을 백필/조회해서 CAPI 전송 직전에 조인.
- 로컬 `imweb_orders`에 order item 테이블 또는 item JSON을 추가 적재.

현재 단계에서는 상품 ID를 임의로 추정하지 않는 것이 맞다. 잘못된 `content_ids`는 이벤트 품질을 오히려 해칠 수 있다.

## Toss/Imweb 상품명 소스 확인 추가

요청에 따라 `tossapi.md`, `imwebapi.md`, 로컬 SQLite schema를 다시 확인했다.

### Toss API 결론

Toss API에서는 특정 결제의 `orderName`은 가져올 수 있다.

확인 경로:

```text
GET /v1/payments/{paymentKey}
GET /v1/payments/orders/{orderId}
```

우리 백엔드 경유 호출:

```bash
curl "http://localhost:7020/api/toss/payments/orders/{orderId}?store=biocom"
```

단, `orderName`은 "구매상품 대표명"이다. 예를 들면 `대표상품 외 N건` 같은 문자열이다.

따라서 다음 용도로는 쓸 수 있다.

- 사람이 주문을 대략 식별하는 보조값
- Toss 결제 상세 샘플 검증
- 주문번호/결제키/금액/상태 대사 시 보조 확인

하지만 다음 용도로는 부적합하다.

- 상품별 ROAS
- Meta CAPI `content_ids`
- 상품별 수량/단가/할인 계산
- 검사권/영양제/커피/정기구독 상품군 확정

이유:

- Toss는 PG라서 상품 카탈로그/주문 라인아이템의 정본 시스템이 아니다.
- `GET /v1/transactions`와 `GET /v1/settlements`에는 상품명/상품 ID/라인아이템이 없다.
- 현재 로컬 `toss_transactions`, `toss_settlements` 테이블도 결제/정산 중심 schema라 상품 컬럼이 없다.
- `Payment.metadata`는 존재하지만 결제 요청 시점에 넣어야 내려오는 값이고, 현재 아임웹/Toss 경로에서 상품 ID가 metadata에 들어온 근거는 없다.
- `escrowProducts`는 에스크로 가상계좌 요청 시점의 특수 파라미터이지, 기존 주문의 상품 목록 조회 API가 아니다.

결론:

Toss는 결제 상태/금액/승인/취소 검증의 정본으로 쓰고, 상품명/상품 ID 정본으로 쓰면 안 된다.

### Imweb API 결론

`imwebapi.md` 기준으로 현재 붙어 있는 레거시 아임웹 주문 API는 상품명 정본으로 부족하다.

현재 사용 중인 주문 API:

```text
GET https://api.imweb.me/v2/shop/orders?offset={page}&limit={limit}
GET https://api.imweb.me/v2/shop/orders/{order_no}
```

로컬 캐시 `imweb_orders` schema도 확인했다.

```text
order_no, order_code, order_time, complete_time,
member_code, orderer_name, orderer_call,
pay_type, pg_type,
total_price, payment_amount, coupon_amount,
use_issue_coupon_codes, raw_json
```

즉, 현재 로컬 `imweb_orders`는 주문 헤더 중심이다. 상품 라인아이템 전용 컬럼이 없다.

아임웹에서 상품명/상품 ID를 가져오는 후보는 3가지다.

1. 운영 조회용 Postgres `tb_iamweb_users.product_name`
2. 권한/OAuth가 확보된 신규 `openapi.imweb.me/orders` 계열 주문 API
3. 결제완료 페이지 dataLayer 또는 DOM에서 상품 line item을 읽어 payment-success 원장에 저장

현재 가장 현실적인 정본 후보는 운영 조회용 `tb_iamweb_users`다.

`imwebapi.md`에 기록된 운영 DB 주요 상품 관련 컬럼:

```text
order_number
product_name
option_name
order_section_item_no
order_item_code
item_price
base_item_price
coupon_discount
total_price
total_discount_price
payment_method
payment_status
paid_price
payment_complete_time
```

주의:

- 같은 주문번호가 여러 상품 라인으로 나뉠 수 있다.
- 주문 단위 ROAS는 `order_number` 기준 dedupe가 필요하다.
- 상품별 ROAS는 라인아이템 단위로 봐야 한다.
- 운영 DB는 read-only 조회만 해야 한다.

현재 `GET https://openapi.imweb.me/orders`는 기존 토큰으로는 `401 / 토큰이 유효하지 않습니다`가 기록되어 있어, 이 경로를 쓰려면 권한/OAuth 확인이 필요하다.

### 상품명/상품 ID 확보 우선순위

1. `tb_iamweb_users.product_name`, `order_item_code`, `order_section_item_no`를 read-only로 조회해서 주문번호 기준 조인한다.
2. `payment_success` 원장에 주문번호가 있으므로 `orderIdBase`와 `order_number`를 맞춰 상품 라인아이템을 붙인다.
3. 결제완료 footer에서 아임웹 dataLayer 또는 DOM 상품 배열을 직접 읽을 수 있으면, 신규 주문부터 metadata에 `items` 또는 `products`를 넣는다.
4. GA4 BigQuery `items`는 보조 검증으로 사용한다.
5. Toss `orderName`은 보조 표시값으로만 쓴다.

최종 판단:

상품명은 Imweb/운영 주문 라인아이템 쪽에서 풀어야 하고, Toss로 풀면 안 된다. Toss는 결제 상태 확정과 금액 대사에 집중시키는 것이 맞다.

## CAPI 로그 재점검

로컬 CAPI 전송 로그 기준으로 운영 성공 로그만 재집계했다.

| 구간 | CAPI success rows | unique event_id | retry-like groups | retry-like rows | multi-event-id risk groups | multi-event-id risk rows |
|---|---:|---:|---:|---:|---:|---:|
| 최근 24시간 | 146 | 70 | 38 | 114 | 0 | 0 |
| post-fix 이후, 2026-04-10 00:00 KST 이후 | 217 | 126 | 53 | 144 | 0 | 0 |
| 최근 3일 | 484 | 215 | 140 | 405 | 1 | 6 |

해석:

- post-fix 이후에는 같은 주문+Purchase가 서로 다른 event_id로 나간 고위험 그룹은 0건이다.
- 최근 24시간도 multi-event-id risk는 0건이다.
- retry-like 그룹은 남아 있다. 이는 같은 event_id 반복 전송이다. 위험도는 multi-event-id보다 낮지만, CAPI-CAPI 같은 채널 내 반복이므로 계속 모니터링해야 한다.
- 최신 운영 CAPI 로그 timestamp는 `2026-04-11T14:02:41Z`, 한국시간 `2026-04-11 23:02:41 KST`다.

주의:

- 위 로그는 대부분 과거 event_id 형식이다.
- 최초 코드 변경은 `purchase:{orderId}` 형식이었지만, 실제 Browser Pixel이 `Purchase.{orderCode}`를 쓰는 것이 확인되어 서버 CAPI도 같은 형식으로 재수정했다.

## 검증 결과

실행한 검증:

```bash
cd backend && npm run typecheck
cd backend && node --import tsx --test tests/attribution.test.ts
git diff --check -- backend/src/metaCapi.ts backend/tests/attribution.test.ts capivm/capi.md
```

결과:

- TypeScript typecheck 통과.
- attribution test 25개 통과.
- diff whitespace check 통과.

## 추가 개발 결과: 가상계좌 미입금 Browser Purchase 차단 스니펫

2026-04-12에 가상계좌 미입금 주문완료 화면용 Browser Pixel `Purchase` 가드 스니펫을 작성했다.

작성 파일:

- [header_purchase_guard_0412.md](/Users/vibetj/coding/seo/footer/header_purchase_guard_0412.md)

무엇을 막는가:

- 서버 CAPI가 아니다.
- 우리 원장 적재 API도 아니다.
- 아임웹/Meta/GTM 브라우저 태그가 주문완료 화면에서 `fbq('track', 'Purchase', ...)`를 먼저 호출하는 경우만 가로챈다.

왜 필요한가:

- 가상계좌 주문은 “주문 생성”과 “입금 완료”가 다르다.
- 미입금 상태에서 Browser Pixel `Purchase`가 나가면 Meta는 이미 구매로 학습/보고할 수 있다.
- 우리 서버 CAPI는 local ledger `confirmed` 기준으로만 Purchase 후보를 만들고 있어, 현재 남은 과대 후보는 브라우저 Pixel 쪽 정의 차이다.

어떻게 동작하는가:

- 아임웹 결제완료 URL인 `/shop_payment_complete` 또는 `/shop_order_done`에서만 실행된다.
- `window.fbq`를 감싸서 `track Purchase`, `trackSingle Purchase` 호출만 700ms 보류한다.
- 보류 시간 동안 페이지 텍스트에서 `가상계좌`, `무통장`, `계좌번호`, `입금기한`, `입금대기`, `입금확인` 같은 문구 조합을 찾는다. 단어 하나만으로 과도 차단하지 않도록 강한 가상계좌 문구가 2개 이상 있거나, 가상계좌/무통장과 입금대기 문구가 같이 있는 경우 위주로 막는다.
- 동시에 `신용카드`, `카드결제`, `카드 결제` 문구가 있으면 카드 결제로 보고 Purchase를 통과시킨다.
- 가상계좌 미입금으로 판단되면 Browser `Purchase`를 보내지 않고, 대신 `VirtualAccountIssued` custom event를 보낸다.
- `VirtualAccountIssued`에는 기존 Purchase의 `value`, `currency`, `content_ids` 등이 있으면 그대로 싣고, `payment_status=pending`, `payment_method=virtual_account`, `order_code`, `order_no`, `payment_code`, `payment_key`, `snippet_version`을 추가한다.

검증 결과:

- `node --check /tmp/biocom_purchase_guard_0412.js` 통과.
- 로컬 시뮬레이션에서 카드 문구(`신용카드`)는 기존 `Purchase`가 그대로 통과했다.
- 로컬 시뮬레이션에서 가상계좌/입금대기 문구는 `Purchase`가 차단되고 `VirtualAccountIssued`로 전환됐다.
- 로컬 시뮬레이션에서 단순 푸터성 `무통장입금 안내` 문구만 있는 경우는 과도 차단하지 않고 `Purchase`를 통과시켰다.

운영 반영 조건:

- 이 코드는 반드시 아임웹 **헤더 코드 상단** 또는 Meta Pixel/GTM보다 먼저 실행되는 위치에 넣어야 한다.
- 기존 footer 하단에만 넣으면 이미 발화된 Browser `Purchase`는 막지 못할 수 있다.
- 반영 후 카드 결제 주문완료에서는 Meta Pixel Helper에 `Purchase`가 계속 보여야 한다.
- 반영 후 가상계좌 미입금 주문완료에서는 Meta Pixel Helper에 `Purchase`가 보이지 않고 `VirtualAccountIssued`가 보여야 한다.

한계:

- 브라우저 화면 텍스트 기반 판정이다.
- 아임웹 주문완료 화면에 가상계좌/입금대기 문구가 없다면 브라우저만으로는 미입금 여부를 확정하기 어렵다.
- 그 경우 다음 단계는 백엔드에 `order_no/paymentKey` 상태 조회 API를 만들고, Browser `Purchase`를 잠깐 보류한 뒤 `confirmed`일 때만 통과시키는 방식이다.

### 남은 것 1. 가상계좌 미입금 Browser Purchase 운영 검증

스니펫 작성은 완료했지만, 실제 아임웹 운영 화면 반영 검증은 아직 필요하다.

확인할 것:

- 가상계좌 미입금 주문완료 화면에서 `Purchase`가 사라지는지.
- 같은 화면에서 `VirtualAccountIssued`가 뜨는지.
- 카드 결제 주문완료 화면에서는 `Purchase`가 정상 유지되는지.
- 브라우저 콘솔에 `[biocom-purchase-guard] Blocked unpaid virtual account Purchase` 로그가 찍히는지.

### 남은 것 2. Meta Test Events dedup 확인

아직 완료하지 못했다.

필요한 것:

- Meta Events Manager의 `test_event_code`.
- 카드 결제 또는 입금 완료된 confirmed 테스트 주문 1건.
- Meta Test Events 화면에서 Browser Purchase와 Server Purchase 상세 캡처.

### 남은 것 3. Server content_ids/contents 100% 보강

아직 완료하지 못했다.

이유:

- 현재 원장 metadata에 상품 ID가 없다.
- 아임웹/Toss/결제완료 URL만으로 상품 ID를 안정적으로 추론할 수 없다.

## 다음에 내가 할 일

1. 가상계좌 미입금 Browser Purchase 가드가 운영 화면에서 동작하는지 Pixel Helper로 검증한다.
2. 카드 결제 화면에서 Purchase가 차단되지 않는지 확인한다.
3. Browser/Server `event_id`가 같은지 확인 결과를 받아 `meta/metareport.md`와 `data/roasphase.md`에 기록한다.
4. 상품 ID 보강은 아임웹 dataLayer 또는 주문 상세 API 중 실제로 가능한 경로를 정한 뒤 진행한다.
5. CAPI 로그를 다시 뽑아 새 event_id 형식이 적용되는지 확인한다.

## TJ님이 할 일

1. Meta Events Manager에서 biocom Pixel의 Test Events 화면을 열고 `test_event_code`를 전달한다.
2. 카드 결제 또는 입금 완료된 가상계좌 테스트 주문 1건을 만든다.
3. 주문번호, 결제수단, 결제완료 URL, 결제/입금 완료 시각을 전달한다.
4. Test Events에서 Browser Purchase와 Server Purchase를 열어 `event_id`, `value`, `currency`, `event_source_url`, `order_id`가 보이는 화면을 캡처한다.
5. [header_purchase_guard_0412.md](/Users/vibetj/coding/seo/footer/header_purchase_guard_0412.md)를 아임웹 헤더 코드 상단에 넣고, 가상계좌 미입금 주문완료와 카드 결제 주문완료를 각각 1건씩 Pixel Helper로 확인한다.

## 멀티 에이전트 사용 여부

사용하지 않았다.

이유:

- 이번 작업은 코드 위치와 원인이 이미 좁혀져 있었다.
- 외부 리서치보다 로컬 코드와 로컬 원장 확인이 핵심이었다.
- 병렬 에이전트를 쓰면 같은 파일을 동시에 만질 가능성이 있어 오히려 변경 충돌 위험이 더 컸다.

## 최종 판단

이번 작업으로 Server CAPI 쪽은 한 단계 정리됐다.

- 앞으로 새 Server CAPI Purchase는 가능한 경우 Browser Pixel과 같은 `Purchase.{orderCode}` 기준으로 나가므로, 카드 결제 완료 주문의 dedup 조건을 맞출 수 있다.
- Server event_source_url은 절대 URL로 안정화됐다.
- 상품 정보는 받을 준비를 해뒀지만, 현재 원장에는 상품 ID가 없어 추가 수집 경로가 필요하다.

하지만 Meta ROAS 과대 원인에서 가장 큰 실제 누수 후보는 아직 남아 있다.

**가상계좌 미입금 Browser Purchase 차단은 스니펫 작성까지 완료됐다. 다음 1순위는 아임웹 헤더 상단 반영 후 실제 가상계좌/카드 주문완료 화면에서 Pixel Helper로 검증하는 것이다.**
