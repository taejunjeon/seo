1. 요약

현재 실패 지점은 CAPI가 아니라 Toss 확정 테이블 최신화다.

SEO 백엔드의 15분 job은 `tb_sales_toss`를 읽어 자체 Attribution 원장의 `pending` 주문을 `confirmed/canceled`로 승격하는 소비자다. 그런데 운영 Postgres의 `tb_sales_toss`는 여전히 `approved_at = 2026-04-10 04:44:52 KST`에서 멈춰 있고, 2026-04-11 승인 행은 0건이다. 반대로 Toss 직접 결제 상세 API는 최신 결제를 조회할 수 있으므로, 이번 작업에서는 `tb_sales_toss` 미매칭 pending 주문에 한해 Toss 직접 API fallback을 붙였다.

2. 개발 반영

반영 성공:

- `backend/src/routes/attribution.ts`: `POST /api/attribution/sync-status/toss`가 기존처럼 먼저 `tb_sales_toss`를 조회하고, 매칭 실패한 pending 주문만 `paymentKey` 또는 `orderId`로 Toss 직접 결제 상세 API를 조회하도록 fallback을 추가했다.
- `backend/src/routes/attribution.ts`: direct fallback으로 매칭된 행은 `matchType = direct_payment_key/direct_order_id`로 구분하고, 원장 업데이트 시 `metadata.tossSyncSource = toss_direct_api_fallback`, `metadata.tossDirectFallbackAt`을 남기도록 했다.
- `backend/src/routes/attribution.ts`: API 응답 summary에 `directFallbackRows`, `directFallbackErrors`를 추가했다.
- `backend/src/attribution.ts`: `TossJoinRow.syncSource`를 추가해 `tb_sales_toss` 기반 승격과 Toss 직접 API fallback 기반 승격을 분리했다.
- `backend/tests/attribution.test.ts`: direct fallback row가 `confirmed` 승격되고 source metadata를 남기는 테스트를 추가했다.

반영하지 않은 것:

- revenue 운영 환경의 `POST /api/scheduler/sales/toss-sync?month=2026-04` 수동 실행은 하지 않았다. 이 호출은 운영 Postgres `tb_sales_toss`를 upsert하는 생산자 sync라 운영 데이터 변경에 해당한다. 실행하려면 별도 승인 후 진행하는 것이 맞다.
- 수동으로 `POST /api/attribution/sync-status/toss?dryRun=false`를 호출하지는 않았다. 다만 로컬 백엔드 background job이 켜진 상태에서 코드 변경 후 15분 주기 sync가 자동 실행되어, SEO 로컬 Attribution 원장에는 direct fallback 기반 confirmed 승격 37건이 실제 반영됐다. 운영 Postgres `tb_sales_toss`는 변경하지 않았다.

3. 검증 결과

코드 검증:

```text
npm run typecheck
결과: 통과

npx tsx --test tests/attribution.test.ts
결과: 22개 테스트 통과

git diff --check -- backend/src/attribution.ts backend/src/routes/attribution.ts backend/tests/attribution.test.ts
결과: 통과
```

실제 dry-run 검증:

```text
POST /api/attribution/sync-status/toss?dryRun=true&limit=50

totalCandidates: 50
matchedRows: 38
updatedRows: 37
writtenRows: 0
skippedNoMatchRows: 12
skippedPendingRows: 1
directFallbackRows: 38
directFallbackErrors: 12
```

해석:

- `tb_sales_toss`가 최신이 아니어도 Toss 직접 API fallback으로 최신 pending 후보 50건 중 38건을 결제 상세 API까지 확인했다.
- 이 중 37건은 `confirmed`로 승격 가능한 상태였다.
- 이 최초 확인 자체는 `writtenRows = 0`인 preview였다.
- 대표 confirmed 후보는 `202604117818380`, `202604116282934`, `202604102354644`, `202604101193543`, `202604101109000`이다.
- 일부 404는 paymentKey가 없는 orderId 또는 별도 스토어/미존재 결제 정보로 보이며, fallback error 목록에 남도록 했다.

이후 상태 정정:

```text
로컬 백엔드 background sync 자동 실행 감지

SEO 로컬 Attribution 원장 payment_success:
total: 692
pending: 261
confirmed: 425
canceled: 6
metadata.tossSyncSource = toss_direct_api_fallback: 37
metadata.tossSyncSource = tb_sales_toss: 394

direct fallback 승격 시각:
tossDirectFallbackAt: 2026-04-10T15:12:12.856Z
한국시간: 2026-04-11 00:12:12.856 KST
```

해석:

- direct fallback은 실제로 작동했고, 로컬 Attribution 원장 기준으로 37건이 `confirmed`로 승격됐다.
- 이 변경은 SEO 로컬 SQLite 원장 변경이고, 클라우드 운영 Postgres `tb_sales_toss` 변경이 아니다.
- post-fix CAPI log는 여전히 0건이라, CAPI auto_sync 전송 및 dedup 효과는 아직 별도 확인이 필요하다.

50건 중 나머지 12건 분석:

```text
최초 dry-run에서 direct fallback으로 confirmed까지 간 후보: 37건
Toss status가 아직 pending이라 승격하지 않은 후보: 1건
나머지 unmatched: 12건
```

12건 분류:

```text
1. biocom, paymentKey 없음: 7건
   202604102258699
   202604105489168
   202604100782161
   202604104318693
   202604095691591
   202604091094393
   202604095838130

2. thecleancoffee, iw_th paymentKey 있음: 5건
   202604103944654 / iw_th20260410132431AXXi2
   202604102083616 / iw_th20260410094959xQ8d7
   202604104726533 / iw_th20260410082502xJcn7
   202604102669602 / iw_th20260410082407uPqf1
   202604099781737 / iw_th20260409225515yBiX3
```

biocom 7건 해석:

```text
공통점:
- source: biocom_imweb
- paymentKey: 없음
- referrer: https://biocom.kr/backpg/payment/oms/OMS_payment.cm
- referrerPayment: 없음
- Toss 직접 API: base orderNo, -P1 orderId, biocom/coffee secret 모두 404

아임웹 로컬 주문 캐시 대조:
- free/0원 주문: 3건
  202604105489168, 202604100782161, 202604104318693
- nicepay/etc 주문: 4건
  202604102258699, 202604095691591, 202604091094393, 202604095838130
```

판정:

- 이 7건은 Toss 결제 상세 API로 확정하면 안 되는 주문이다.
- 0원 주문은 Toss 결제키가 없는 것이 정상에 가깝다.
- `nicepay/etc` 주문은 Toss가 아니라 Nicepay/기타 PG 경로로 보이므로 Toss direct fallback 대상이 아니다.
- 그래서 SEO 코드도 보정했다. 이제 direct fallback은 무조건 orderNo를 Toss orderId로 조회하지 않고, `paymentKey` 또는 referrer의 PG `orderId=-P1`가 있을 때만 Toss 직접 API를 호출한다.

thecleancoffee 5건 해석:

```text
공통점:
- source: thecleancoffee_imweb
- paymentKey: iw_th...
- referrerPayment.orderId: ...-P1 존재
- Toss 직접 API 결과:
  paymentKey 조회: coffee secret 404, biocom secret 404
  base orderNo 조회: coffee/biocom 모두 404
  -P1 orderId 조회: coffee/biocom 모두 404

추가 제약:
- thecleancoffee 아임웹 로컬 주문 캐시는 lastOrderAt = 2026-04-04T01:38:13.000Z에서 멈춰 있다.
- 문제 5건은 2026-04-09~2026-04-10 주문이라 로컬 아임웹 캐시에 아직 없다.
```

판정:

- 이 5건은 현재 SEO에 설정된 Toss live secret으로는 조회되지 않는다.
- 원인 후보는 1) 더클린커피 Toss live secret이 해당 결제 merchant와 다름, 2) 아임웹의 `iw_th` paymentKey가 현재 설정된 Toss 계정과 연결되지 않음, 3) 더클린커피 주문 캐시가 오래되어 결제 상태를 아임웹 API로 대조할 수 없음 중 하나다.
- 다음 조치는 더클린커피 아임웹 주문 sync 최신화 또는 더클린커피 Toss secret/merchant 매핑 확인이다.

코드 보정 후 dry-run 재확인:

```text
POST /api/attribution/sync-status/toss?dryRun=true&limit=50

totalCandidates: 50
matchedRows: 5
updatedRows: 1
writtenRows: 0
skippedNoMatchRows: 45
skippedPendingRows: 4
directFallbackRows: 5
directFallbackErrors: 25
```

해석:

- 앞서 37건이 로컬 원장에서 이미 confirmed로 승격됐기 때문에 다음 dry-run의 후보군이 달라졌다.
- orderNo만 있는 biocom 0원/Nicepay 주문은 더 이상 Toss 직접 API를 불필요하게 호출하지 않는다.
- 남은 directFallbackErrors는 대부분 `iw_th` 더클린커피 결제키다. 이건 SEO 코드 문제가 아니라 더클린커피 Toss/아임웹 동기화 또는 credential/merchant 매핑 문제로 분리해 보는 게 맞다.

운영 Postgres read-only 확인:

```text
tb_sales_toss total: 7501
tb_sales_toss max_approved_at: 2026-04-10 04:44:52
tb_sales_toss rows_20260410: 8
tb_sales_toss max_20260410: 2026-04-10 04:44:52
tb_sales_toss rows_20260411: 0
tb_sales_toss max_20260411: null
tb_sales_toss max_synced_at raw DB value: 2026-04-09 21:00:10.31918
```

제공 가능/불가능 구분:

```text
revenue 쪽 toss-sync 수동 실행 결과
상태: 미제공
이유: 이 호출은 운영 Postgres tb_sales_toss를 upsert하는 생산자 sync라 클라우드 운영 DB 변경에 해당한다. 우리는 운영 DB를 직접 변경하면 안 되고 변경 권한도 없다.

성공/실패
상태: 미실행이므로 성공/실패 판정 불가

몇 건 적재됐는지
상태: 미실행이므로 제공 불가

tb_sales_toss.max(approved_at) 전후 값
실행 전/현재 확인값: 2026-04-10 04:44:52 KST
실행 후 값: 미실행이므로 없음

대신 제공 가능한 값:
tb_sales_toss total: 7501
tb_sales_toss rows_20260410: 8
tb_sales_toss rows_20260411: 0
tb_sales_toss max_synced_at raw DB value: 2026-04-09 21:00:10.31918
```

실행 방향 정정:

- 클라우드 운영 DB `tb_sales_toss`는 우리가 직접 변경하지 않는다.
- revenue 폴더의 로컬 코드는 수정 가능하다.
- 더 좋은 방향은 SEO 프로젝트 안에 필요한 직접 조회/fallback 코드를 붙여, 운영 Postgres 생산자 sync 지연에 막히지 않고 필요한 결제 상태만 정확히 받아오는 것이다.
- 이번 작업은 그 방향으로 진행했다. SEO의 `sync-status/toss`가 `tb_sales_toss` 미매칭 최신 주문을 Toss 직접 API로 확인할 수 있게 됐다.

post-fix CAPI log 재확인:

```text
GET /api/meta/capi/log?limit=500&scope=recent_operational&since=2026-04-10T00:00:00.000Z&include_dedup_candidates=1&dedup_candidate_limit=10

total: 0
success: 0
duplicateOrderEventGroups: 0
multiEventIdGroups: 0
multiEventIdRows: 0
dedupCandidateDetails: []
```

해석:

- SEO 로컬 Attribution 원장 승격은 background job으로 37건 발생했지만, post-fix CAPI 운영 로그는 아직 0건이다.
- 따라서 dedup 수정 효과는 아직 최종 판정할 수 없다.
- 즉 현재 남은 검증 포인트는 CAPI auto_sync가 이 confirmed 후보들을 실제로 전송한 뒤에도 `multiEventIdGroups = 0`을 유지하는지다.

식별자 품질:

```text
GET /api/attribution/caller-coverage?source=biocom_imweb&paymentLimit=5&checkoutLimit=5

payment_success total: 601
withGaSessionId: 121, 20.13%
withClientId: 117, 19.47%
withUserPseudoId: 117, 19.47%
withAllThree: 117, 19.47%

checkout_started total: 0
```

해석:

- 최신 구간의 all-three 개선 신호는 있지만, 전체 live `payment_success` 기준으로는 아직 19.47%다.
- `checkout_started`가 아직 없어서 체크아웃 단계의 식별자 선행 수집은 별도 트랙으로 계속 필요하다.

4. 지금 필요한 자료

추가로 꼭 필요한 자료는 아래 2개다.

자료 1: revenue 쪽 toss-sync 수동 실행 결과

```text
필요 호출:
POST /api/scheduler/sales/toss-sync?month=2026-04

필요 기록:
- 성공/실패
- 몇 건 읽었는지
- 몇 건 upsert됐는지
- 실행 전 tb_sales_toss.max(approved_at)
- 실행 후 tb_sales_toss.max(approved_at)
- 실행 후 tb_sales_toss rows_20260411
- 에러가 있으면 에러 메시지
```

왜 필요한가:

`tb_sales_toss` 생산자 sync가 정상화되면 정본 테이블 기준으로 pending 승격이 가능해진다. direct fallback은 운영 안정화용 보조 경로이고, 정본은 여전히 revenue의 `tb_sales_toss`가 맞다.

자료 2: 그 직후 post-fix CAPI log

```text
필요 호출:
GET /api/meta/capi/log?limit=500&scope=recent_operational&since=2026-04-10T00:00:00.000Z&include_dedup_candidates=1&dedup_candidate_limit=10

필요 기록:
- total
- success
- multiEventIdGroups
- multiEventIdRows
- duplicateOrderEventGroups
- dedupCandidateDetails
```

왜 필요한가:

현재 post-fix CAPI log는 0건이라 dedup 수정 효과를 판정할 수 없다. revenue sync 또는 direct fallback으로 `confirmed` 후보를 만든 뒤 CAPI auto_sync가 실제로 돈 다음에야 “같은 주문+이벤트에 서로 다른 event_id가 다시 생기는지”를 판정할 수 있다.

5. 다음 실행 순서

1. 운영 DB 정본을 살릴 경우, 운영 권한자가 revenue 운영 환경에서 `POST /api/scheduler/sales/toss-sync?month=2026-04`를 1회 실행하고 결과를 공유한다.
2. 실행 직후 `tb_sales_toss.max(approved_at)`이 `2026-04-10 04:44:52 KST` 이후로 전진했는지 확인한다.
3. SEO 자체 보강 경로는 이미 붙었다. `tb_sales_toss`가 계속 늦어져도, paymentKey/referrer PG orderId가 있는 Toss 주문은 SEO `sync-status/toss` direct fallback으로 확정 상태를 받아올 수 있다.
4. CAPI auto_sync가 돈 다음 post-fix CAPI log를 다시 확인한다.
5. 더클린커피 `iw_th` 404는 더클린커피 아임웹 주문 sync 최신화와 Toss secret/merchant 매핑 확인을 별도 트랙으로 처리한다.

6. nicepay 주문 상품군 확인

질문: 12건 중 biocom `nicepay/etc`로 남았던 4건이 검사권/영양제/커피/정기구독 중 무엇인가?

확인 방법:

- 레거시 아임웹 주문 상세 API `GET /v2/shop/orders/{order_no}` 조회
- biocom 아임웹 상품 API `GET /v2/shop/products` 가격 교차 확인
- 운영 조회용 Postgres `tb_iamweb_users` read-only 조회
- 개인정보 필드는 제외하고 주문번호, 상품명, 결제상태, 결제수단, 금액만 확인

결론:

- 4건 모두 biocom 주문이다.
- 4건 모두 커피가 아니다.
- 4건 모두 검사권이 아니다.
- 4건 모두 `payment_method = SUBSCRIPTION`으로 적재된 정기구독 영양제 주문이다.
- `pg_type = nicepay`, `pay_type = etc`로 보이는 이유는 아임웹/PG 결제수단 표기 문제에 가깝고, 상품군 자체는 건강기능식품 정기구독이다.

확인된 상품:

| order_no | 상품군 판정 | 상품명 | 결제상태 | 결제금액 |
|---|---|---|---|---:|
| `202604102258699` | 정기구독 영양제 | `[정기구독] 썬화이버 프리바이오틱스 식이섬유 210g` | `PAYMENT_COMPLETE` | 10,260 |
| `202604095838130` | 정기구독 영양제 | `[정기구독] 썬화이버 프리바이오틱스 식이섬유 210g` | `PAYMENT_COMPLETE` | 5,548 |
| `202604091094393` | 정기구독 영양제 | `[정기구독] 혈당관리엔 당당케어 (120정)` | `PAYMENT_COMPLETE` | 41,800 |
| `202604095691591` | 정기구독 영양제 묶음 | `[정기구독] 클린밸런스 120정` + `[정기구독] 바이오밸런스 90정` | `PAYMENT_COMPLETE` | 18,110 |

가격 검산:

- 썬화이버 2건: `base_item_price = 57,000`, `item_price = 34,900`, 쿠폰 `23,942`, 멤버십 할인 `698` 적용. 1건은 포인트 `4,712`가 추가 적용되어 최종 결제금액이 `5,548`이다.
- 혈당관리엔 당당케어 1건: `base_item_price = 100,000`, `item_price = 41,800`, 쿠폰 없음. 최종 결제금액 `41,800`이다.
- 클린밸런스+바이오밸런스 묶음 1건: 두 상품 라인 합산 `total_price = 61,600`, 총 할인 `43,490`, 최종 결제금액 `18,110`이다.

추가 메모:

- 레거시 아임웹 주문 상세 응답에는 상품 라인아이템이 직접 포함되지 않는다.
- 정식 `openapi.imweb.me/orders`는 현재 biocom 토큰으로도 `401 / 토큰이 유효하지 않습니다`가 나와서 상품 라인아이템 조회 경로로는 바로 사용할 수 없다.
- 이번 판정은 `tb_iamweb_users` read-only 조회에서 `product_name`, `payment_method`, `payment_status`, `paid_price`가 확인되어 확정할 수 있었다.

7. 현재 판정

- 개발 반영: 성공
- 타입체크/테스트: 성공
- dry-run 실데이터 확인: 성공
- SEO 로컬 Attribution 원장 direct fallback 승격: 37건 자동 반영 확인
- revenue `tb_sales_toss` 생산자 sync 정상화: 미수행, 운영 DB 변경 권한 없음
- post-fix CAPI dedup 최종 판정: 아직 불가, 운영 CAPI 로그가 0건
