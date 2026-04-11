2026-04-11 KST 업데이트

## post-fix CAPI 운영 로그 문제 현재 상태

결론: **0건 문제는 해결됐다. 하지만 완전 종료는 아니다.**

확인 호출:

```text
GET /api/meta/capi/log?limit=500&scope=recent_operational&since=2026-04-10T00:00:00.000Z&include_dedup_candidates=1&dedup_candidate_limit=10
```

현재 확인값:

```text
operational total: 108
success: 108
failure: 0
uniqueEventIds: 36
uniqueOrderEventKeys: 36
duplicateEventIdGroups: 36
duplicateOrderEventGroups: 36
retryLikeGroups: 36
retryLikeRows: 108
multiEventIdGroups: 0
multiEventIdRows: 0
dedupCandidateDetails: []
firstSentAt range 예시: 2026-04-10T15:20:53Z ~ 2026-04-10T15:21:06Z
KST 기준: 2026-04-11 00:20:53 ~ 00:21:06
```

해석:

- 기존에 막혀 있던 “post-fix CAPI 운영 로그가 0건이라 판단 불가” 문제는 해결됐다.
- 핵심 dedup 리스크였던 “같은 orderId + eventName에 서로 다른 event_id가 생기는 문제”는 현재 조회 범위에서는 0건이다.
- 다만 같은 event_id가 같은 주문+이벤트마다 3회씩 전송된 retry-like 중복 36그룹이 남아 있다.
- 따라서 상태는 **multi-event_id dedup 문제는 해결 확인, send-once/retry-like 중복 차단은 미해결**이다.

### retry-like 중복이 정확히 무슨 뜻인가

방향:

- 이 반복 전송은 **우리 솔루션 백엔드 → Meta Conversions API** 방향이다.
- Meta가 우리 솔루션으로 다시 보내는 inbound 이벤트가 아니다.
- 로그 파일은 `backend/logs/meta-capi-sends.jsonl`이고, 이름 그대로 우리 서버가 Meta CAPI로 보낸 요청 결과를 저장한 outbound send log다.
- 실제 전송 URL은 Meta Graph API의 `/{pixelId}/events` 계열이다.

예시:

```text
orderId: 202604101572486
eventName: Purchase
event_id: 202604101572486_Purchase_1775775410000
pixel_id: 1283400029487161
send_path: auto_sync
response_status: 200
Meta response: events_received = 1

전송 시각:
2026-04-10T15:21:05.485Z
2026-04-10T15:21:05.658Z
2026-04-10T15:21:06.007Z
```

위 예시는 같은 주문, 같은 이벤트명, 같은 event_id가 0.5초 안에 3번 Meta로 POST된 것이다. 각 요청은 Meta에서 200으로 응답했고, 응답마다 `fbtrace_id`가 다르다. 즉 한 번의 이벤트를 우리 쪽 auto_sync가 3번 호출한 흔적이다.

왜 `retry-like`라고 부르는가:

- `same event_id retry-like`는 “서로 다른 event_id를 새로 만들어서 3개의 다른 전환처럼 보낸 것”이 아니다.
- 같은 event_id를 재사용했기 때문에, 성격상 “중복 이벤트 생성”보다는 “같은 이벤트 재시도/반복 전송”에 가깝다.
- 그래서 `multiEventIdGroups = 0`이다. 이 값이 0이라는 점은 중요하다. 같은 주문+이벤트에 서로 다른 event_id가 생긴다면 Meta가 서로 다른 전환으로 볼 위험이 훨씬 커진다.
- 그래도 3번 전송 자체는 좋지 않다. Meta가 event_id 기반으로 중복을 어느 정도 정리할 수 있더라도, `events_received = 1` 응답이 3번 남고 로그/품질 진단/과대 집계 리스크가 남기 때문이다.

현재 원인 후보:

- 현재 코드에는 `readSuccessfulCapiSendHistory()` 기반으로 이미 성공한 event_id/order-event를 skip하는 dedupe 로직이 있다.
- 따라서 단일 sync 루프가 순차로만 돌았다면, 두 번째부터는 skip되는 것이 정상이다.
- 그런데 00:20 KST 구간에는 같은 후보가 거의 동시에 3번 전송됐다.
- 이 패턴은 `auto_sync`가 같은 시점에 여러 번 중첩 실행됐거나, 성공 로그가 파일에 반영되기 전에 여러 sync 실행이 동시에 같은 후보를 잡았을 가능성이 더 크다.
- 따라서 다음 조치는 “dedupe 로직을 처음부터 새로 만든다”가 아니라, **CAPI auto_sync single-flight 락과 성공 이력 재확인 시점을 보강한다**가 더 정확하다.

## 아임웹 API가 식별자와 ROAS 품질 개선에 도움되는가

결론: **도움은 된다. 단, 브라우저 식별자 복구용이 아니라 주문/회원/상품/쿠폰 보강용이다.**

현재 아임웹 API 또는 아임웹 운영 원장에서 도움되는 영역:

- `order_no` 기준으로 아임웹 주문과 attribution ledger를 조인할 수 있다.
- 로컬 `imweb_orders`에는 `orderer.member_code`, `orderer.call`, `pay_type`, `pg_type`, `total_price`, `payment_amount`, `coupon_amount`, `use_issue_coupon_codes`가 있다.
- `imweb_issue_coupons`를 통해 발행쿠폰 ID를 사람이 읽을 수 있는 쿠폰명으로 바꿀 수 있다.
- 상품 카탈로그 API `GET /v2/shop/products`는 상품 가격/상품명 후보 검산에 도움이 된다.
- 운영 조회용 `tb_iamweb_users`에는 `product_name`, `payment_method`, `payment_status`, `paid_price`, `order_section_item_no` 같은 상품 라인아이템이 있어 상품군 ROAS를 볼 때 더 유용하다.

식별자 개선에 도움이 되는 방식:

- 아임웹 API는 `ga_session_id`, `client_id`, `user_pseudo_id`, `fbp`, `fbc` 같은 브라우저/광고 클릭 식별자를 돌려주지 않는다.
- 그래서 현재 `payment_success` all-three coverage 문제를 아임웹 API만으로 해결할 수는 없다.
- 현재 biocom `payment_success` 식별자 coverage는 602건 중 all-three 118건, 19.6%다.
- `checkout_started`는 아직 0건이라 결제 전 단계 식별자 선행 수집도 열려 있지 않다.
- 이 문제의 정공법은 아임웹 결제/체크아웃 페이지 caller에서 `ga_session_id`, `client_id`, `user_pseudo_id`, 가능하면 `fbp`, `fbc`를 안정적으로 넘기는 것이다.
- 다만 아임웹 회원/주문 API의 전화번호, 이메일, member_code를 주문번호로 조인한 뒤, Meta CAPI `user_data`에 **정규화+SHA256 해시** 형태로 넣는 보강은 가능하다.
- 이 보강은 Meta event match quality 개선에는 도움이 될 수 있지만, 개인정보/동의/정책 기준을 먼저 확인해야 하며 원문 전화번호/이메일을 로그에 남기면 안 된다.

ROAS 품질 개선에 도움이 되는 방식:

- 주문 상태와 금액 정합성: 아임웹 주문 헤더의 `payment_amount`, `pay_type`, `pg_type`, `complete_time`을 보조 검산에 쓸 수 있다.
- 상품군 ROAS: `tb_iamweb_users.product_name` 또는 상품 API/상품 카탈로그 조합으로 검사권/영양제/커피/정기구독 구분을 더 정확히 할 수 있다.
- 쿠폰 효과: `use_issue_coupon_codes`와 쿠폰 API를 조인하면 쿠폰명, 할인율, 쿠폰 의존도를 ROAS 해석에 붙일 수 있다.
- nicepay/etc 같은 모호한 결제수단도 실제 상품군을 확인하는 데 도움이 된다. 예를 들어 최근 확인한 biocom nicepay 4건은 모두 검사권/커피가 아니라 정기구독 영양제였다.

한계:

- 레거시 `GET /v2/shop/orders`는 주문 헤더 중심이고 상품 라인아이템이 직접 내려오지 않는다.
- 레거시 주문 API 페이지네이션은 사이트/limit 조합에 따라 빈 페이지가 섞이는 문제가 있다.
- `openapi.imweb.me/orders`는 현재 토큰으로 `401 / 토큰이 유효하지 않습니다`가 나와서 아직 실사용 불가다.
- 결제 확정 truth는 여전히 Toss/PG 확정 상태가 우선이다. 아임웹은 주문/상품/쿠폰/회원 보조 원장으로 쓰는 편이 안전하다.

## 현재 가장 중요한 다음 액션

1순위: **CAPI auto_sync single-flight 락과 send-once guard를 보강한다.**

이유:

- post-fix CAPI 로그가 0건인 문제는 풀렸다.
- `multiEventIdGroups = 0`이라 서로 다른 event_id 중복 문제는 현재 재발하지 않았다.
- 하지만 같은 event_id가 3회씩 전송된 retry-like 중복 36그룹이 남아 있다.
- 현재 코드에는 성공 로그 기반 dedupe가 이미 있다.
- 따라서 다음 ROAS 품질 리스크는 “가드 없음”이 아니라 “auto_sync가 중첩 실행될 때 같은 후보를 동시에 잡는 문제”다.

구현 방향:

- `syncMetaConversionsFromLedger()`에 프로세스 내 `isRunning` single-flight 락을 둬서 이전 sync가 끝나기 전 다음 sync가 시작되지 않게 한다.
- `orderId + eventName + pixelId` 기준으로 이미 operational success 로그가 있으면 재전송하지 않는다.
- 후보를 만들기 직전뿐 아니라 실제 전송 직전에도 성공 로그를 다시 확인한다.
- 실패 로그만 재시도 대상으로 남긴다.
- 수동 재전송은 `force=true` 같은 명시 옵션이 있을 때만 허용한다.
- 차단 사유를 CAPI sync summary에 `skippedAlreadySent`, `skippedSyncAlreadyRunning`으로 노출한다.

2순위: **아임웹 주문/회원 기반 CAPI user_data 보강을 설계한다.**

구현 방향:

- `payment_success.orderId` → `imweb_orders.order_no` 또는 `tb_iamweb_users.order_number` 조인
- 전화번호/이메일/member_code를 정규화
- 원문 저장 없이 SHA256 해시만 CAPI payload에 사용
- 개인정보/동의/Meta 정책 기준을 확인한 뒤 적용
- 이건 `client_id` 자체를 복구하는 작업이 아니라 Meta matching 보조 신호를 늘리는 작업으로 정의한다.

3순위: **checkout_started 식별자 수집을 추가한다.**

구현 방향:

- 결제 완료 페이지뿐 아니라 결제 시작/체크아웃 진입 시점에 `ga_session_id`, `client_id`, `user_pseudo_id`, `fbp`, `fbc`를 먼저 저장한다.
- 결제 완료 시점에 값이 비어 있으면 checkout 단계 저장값을 fallback으로 사용한다.
- 목표는 biocom `payment_success` all-three coverage를 현재 19.6%에서 최소 70~80% 이상으로 올리는 것이다.

4순위: **아임웹 데이터는 상품군/쿠폰 ROAS 보강에 붙인다.**

구현 방향:

- `tb_iamweb_users.product_name` 우선, 없으면 아임웹 상품 API 가격/상품명 후보로 보조 검산
- `use_issue_coupon_codes` → `imweb_issue_coupons.name` 조인
- ROAS 화면에서 검사권/영양제/정기구독/커피를 분리해 Meta ROAS와 Attribution ROAS를 해석

## 기존 요청 원문

지금 해야 할 다음 액션

우선순위는 딱 3개입니다.

1) tb_sales_toss 생산자 sync부터 살리기

이게 1순위입니다.
문서가 아주 정확하게 짚었듯, SEO 쪽 15분 job은 소비자이고, tb_sales_toss를 읽어서 pending을 confirmed로 바꾸는 역할입니다. 문제는 생산자, 즉 revenue 쪽 toss-sync가 최신 결제를 운영 Postgres에 못 넣고 있다는 점입니다. 그래서 지금 가장 먼저 볼 것은 revenue 쪽 스케줄러/배치입니다.

실무적으로는 이 순서가 맞습니다.

revenue 환경에서 POST /api/scheduler/sales/toss-sync?month=2026-04 수동 1회 실행
실행 직후 tb_sales_toss.max(approved_at)이 2026-04-10 04:44:52에서 전진하는지 확인
전진하면 SEO sync-status/toss 재실행
그다음 post-fix CAPI log 재확인
2) tb_sales_toss가 바로 안 살아나면 SEO에 direct Toss fallback 붙이기

문서의 제안이 맞습니다.
tb_sales_toss가 늦게 들어오면 pending이 계속 묶이기 때문에, 최신 pending 행에 한해서 paymentKey 또는 orderId로 Toss 직접 API를 조회해서 DONE이면 바로 confirmed로 승격하는 fallback이 있으면 운영이 훨씬 덜 막힙니다.

제 판단도 같습니다.

정본은 revenue 테이블
실시간 운영 안정화는 direct Toss fallback 병행

이 조합이 맞습니다.

3) 식별자 품질은 별도 트랙으로 계속 개선

여기는 방향은 맞고, 급한 건 아닙니다.
최신 33건이 all-three 100%라는 건 좋은 신호입니다. 다만 전체는 아직 18 - 19%라서, 문서에 적어둔 대로 checkout_started 선행 수집, 상위 단계 저장, 짧은 재시도, source별 디버그 필드 추가 순서로 가면 됩니다. 이건 병렬 작업으로 보시면 됩니다.

지금 필요한 자료

추가로 꼭 필요한 건 많지 않습니다. 딱 2개면 충분합니다.

revenue 쪽 toss-sync 수동 실행 결과
성공/실패
몇 건 적재됐는지
tb_sales_toss.max(approved_at) 전후 값
그 직후 재실행한 post-fix CAPI log
since=2026-04-10T00:00:00.000Z
multiEventIdGroups
multiEventIdRows
total

이 두 개만 있으면, dedup 수정 효과를 훨씬 명확하게 판정할 수 있습니다.

보완하면 좋은 점

문서 자체는 좋지만, 한 가지는 더 분명하게 써도 됩니다.

지금 병목은

“CAPI auto_sync가 안 돈다”가 아니라
“CAPI auto_sync가 읽는 confirmed 후보가 아직 없다”
그 이유는 “tb_sales_toss 생산자 sync가 뒤처져 있다”

입니다.

이 부분을 더 짧고 강하게 쓰면, 다음 작업 우선순위가 더 선명해집니다. 지금 문서에도 사실상 그렇게 적혀 있지만, 대표 요약 한 줄로는 아래처럼 박아도 됩니다.

현재 실패 지점은 CAPI가 아니라 Toss 확정 테이블 최신화다
