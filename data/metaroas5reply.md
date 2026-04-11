1. 10초 요약

- 판정불가. 2026-04-10 00:00:00 UTC, 한국시간 2026-04-10 09:00:00 KST 이후 운영 CAPI 전송 로그가 아직 0건이라 dedup 수정 효과가 실제 운영 로그에 반영됐는지 판단할 수 없다.
- 단, 같은 시각 이후 biocom 결제완료 원장에는 live `payment_success`가 33건 들어와 있다. 이 33건은 모두 `pending`이고 `approvedAt`이 비어 있어, 현재 CAPI 자동 전송 후보 조건인 `paymentStatus = confirmed`를 통과하지 못한다. 즉 `post-fix dedup 후보 0건`은 “중복 위험이 사라짐”이 아니라 “아직 CAPI로 보낼 confirmed 후보가 없음”으로 해석해야 한다.
- 최근 7일 전체 로그에는 수정 전 위험 후보 `multiEventIdGroups 3그룹 / 12행`이 그대로 보이지만, 이는 post-fix 이후 로그가 아니라서 해결/미해결 판정 근거로 쓰면 안 된다.

2. 핵심 숫자

| 지표 | 값 |
|---|---:|
| post-fix total | 0 |
| post-fix success | 0 |
| post-fix multiEventIdGroups | 0 |
| post-fix multiEventIdRows | 0 |
| post-fix retryLikeGroups | 0 |
| post-fix retryLikeRows | 0 |
| post-fix biocom live payment_success 원장 | 33건, 전부 pending |
| post-fix approvedAt 보유 원장 | 0건 |
| post-fix 식별자 all-three | 33/33, 100% |
| caller coverage allThreeRate | 전체 18.82%, biocom 19.06% |
| 최신 비교 기준값 | 수정 전 최근 7일 multiEventIdGroups 3 / multiEventIdRows 12, 직전 all-three 18.46% → 현재 전체 18.82% |

3. 결론

판정불가.

post-fix 이후 운영 CAPI 전송 로그가 0건이라 완료 기준 1번인 “post-fix 이후 운영 로그가 실제로 존재”를 충족하지 못했다. 따라서 `multiEventIdGroups`가 0으로 보이는 것은 “해결”이 아니라 “검증할 CAPI 전송 로그가 없음”이다.

왜 0건인지도 확인했다. 2026-04-10 00:00:00 UTC 이후 biocom 결제완료 원장은 계속 들어오고 있지만, 조회된 post-fix 33건이 모두 `pending`이고 `approvedAt`이 비어 있다. 코드상 CAPI 자동 전송 후보는 `payment_success + live + confirmed`만 선택한다. 그래서 현재 데이터는 “수집은 됐지만 아직 결제 확정/승인시각이 보강되지 않아 CAPI 발송 후보로 올라가지 않은 상태”다. 다음 Toss/아임웹 확정 동기화 또는 auto_sync 이후 `confirmed`로 바뀐 행이 실제 CAPI로 전송되는지 확인해야 한다.

post-fix 원장 33건이 모두 `pending`인 이유도 추가로 확인했다. 결제완료 receiver는 고객 브라우저에서 넘어온 결제완료 URL/referrer를 원장에 남기는 역할이고, 이 payload에는 보통 `paymentStatus`나 `approvedAt`이 없다. 코드상 `payment_success`는 명시 상태가 없으면 기본값이 `pending`이다. 이후 별도 동기화가 `tb_sales_toss`에서 같은 `paymentKey` 또는 `orderId`를 찾아 `DONE/PAID`를 확인해야 `confirmed`로 승격된다.

현재는 이 승격 단계가 막혀 있다. post-fix 33건 중 29건은 `paymentKey`가 있지만, `tossSyncSource`가 붙은 행은 0건이고 `approvedAt`이 채워진 행도 0건이다. `POST /api/attribution/sync-status/toss?dryRun=true&limit=200` 기준 최신 pending 후보 200건이 전부 `toss row not found`로 skip됐다. 또한 Postgres `tb_sales_toss`의 최신 `approved_at`은 테이블 문자열 기준 `2026-04-10 04:44:52`이고, post-fix 기준인 2026-04-10 09:00:00 KST 이후 결제키 샘플 6개는 `tb_sales_toss`에서 매칭 0건이었다. 즉 아임웹 결제완료 원장은 최신 결제까지 들어오지만, 결제 확정 소스인 Toss 테이블이 post-fix 구간까지 아직 따라오지 못해서 모두 `pending`으로 남아 있다.

`tb_sales_toss.approved_at`이 왜 `2026-04-10 04:44:52`에서 멈춰 있는지도 확인했다. 현재 SEO 백엔드는 이 테이블을 직접 적재하지 않는다. `backend/src/routes/attribution.ts`는 `DATABASE_URL`로 연결된 운영 Postgres에서 `tb_sales_toss`를 read-only로 조회하고, `payment_key`, `order_id`, `approved_at`, `status`, `channel`, `store`, `total_amount`를 읽어온다. `approved_at`은 `tb_sales_toss` 컬럼 타입도 `character varying`이고, SEO 백엔드에서는 이 문자열을 `TossJoinRow.approvedAt`으로 받은 뒤 원장 업데이트 시 `normalizeApprovedAtToIso`로 ISO 시각으로 바꿔 저장한다.

따라서 `2026-04-10 04:44:52`는 SEO 백엔드가 만든 값이 아니라 운영 Postgres `tb_sales_toss`에 현재 들어 있는 최신 승인시각이다. 같은 테이블을 직접 조회한 결과 2026-04-10 행은 8건뿐이고 최신 행은 `payment_key=iw_bi20260410044404uISt3`, `order_id=202604108566101-P1`, `status=DONE`, `approved_at=2026-04-10 04:44:52`였다. 직전 날짜들은 2026-04-09 76건, 최신 `23:49:14`; 2026-04-08 94건, 최신 `23:48:43`까지 들어와 있으므로 2026-04-10만 새벽 이후가 비어 있는 부분 적재 상태로 보는 게 맞다.

중요한 반증도 있다. Toss Payments 직접 결제 상세 API는 post-fix 주문을 정상 조회한다. 예를 들어 `/api/toss/payments/orders/202604101193543-P1?store=biocom`은 `status=DONE`, `approvedAt=2026-04-10T23:34:21+09:00`, `paymentKey=iw_bi20260410233329sWLu6`를 반환했고, `/api/toss/payments/orders/202604102354644-P1?store=biocom`도 `status=DONE`, `approvedAt=2026-04-10T23:46:08+09:00`로 조회됐다. 즉 “토스에 결제가 없다”가 아니라 “운영 Postgres의 `tb_sales_toss` 동기화가 직접 Toss API보다 뒤처져 있다”가 현재 원인이다.

현재 코드의 자동 상태 승격은 15분마다 돌지만, 이 job은 `tb_sales_toss`를 갱신하지 않고 이미 들어온 `tb_sales_toss` 행을 읽어 local attribution ledger의 `pending`을 `confirmed/canceled`로 바꾸는 역할만 한다. 별도로 구현된 `/api/toss/sync`는 Toss API에서 `transactions`/`settlements`를 가져와 로컬 SQLite의 `toss_transactions`/`toss_settlements`에 저장하는 경로이고, 운영 Postgres `tb_sales_toss`를 갱신하지 않는다. 그래서 `/api/toss/sync`를 돌린다고 지금의 `tb_sales_toss.max(approved_at)`이 바로 바뀌지는 않는다.

15분 최신화에 대한 표현은 정정한다. 현재 SEO 백엔드에서 확인되는 15분 주기는 `backend/src/bootstrap/startBackgroundJobs.ts`의 `Attribution status sync` 주기다. 이 작업은 15분마다 `tb_sales_toss`를 읽어서 우리 attribution ledger의 `pending` 행을 승격시키는 소비자 작업이지, `tb_sales_toss`를 채우는 생산자 작업이 아니다. `tb_sales_toss` 자체 적재는 revenue 프로젝트의 `POST /api/scheduler/sales/toss-sync?month=YYYY-MM` 경로에서 `sync_toss_sales`가 월 단위로 Toss 거래목록과 결제 상세 API를 조회한 뒤 `upsert_toss`로 운영 Postgres에 upsert하는 구조다. 즉 현재 코드 기준으로는 “`tb_sales_toss`가 15분마다 최신화된다”고 단정하면 안 된다. 맞는 표현은 “SEO의 pending 승격 job은 15분마다 돌지만, 승격 source인 `tb_sales_toss`의 최신성은 revenue 쪽 Toss sync 성공 여부에 달려 있다”다.

타임존도 확인했다. `tb_sales_toss.approved_at = 2026-04-10 04:44:52`는 한국시각이다. 같은 주문 `202604108566101-P1`을 Toss 직접 API로 조회하면 `approvedAt = 2026-04-10T04:44:52+09:00`으로 내려오고, revenue 동기화 코드가 이를 KST로 변환한 뒤 `YYYY-MM-DD HH:mm:ss` 문자열로 저장한다. DB 세션의 `TimeZone`은 UTC였지만, `approved_at` 컬럼은 timestamp가 아니라 문자열(`character varying`)이므로 DB timezone 변환 대상이 아니다.

4. 남아 있는 위험

- post-fix 운영 로그 부재 → 수정 효과를 실제로 검증하지 못함 → 다음 auto_sync 이후 같은 쿼리를 다시 실행한다.
- post-fix 원장 33건이 모두 pending → CAPI 후보 자체가 아직 없음 → Toss/아임웹 확정 동기화 이후 같은 주문들이 `confirmed`로 바뀌는지 확인한다.
- Toss 확정 소스 지연 → `tb_sales_toss` 최신 `approved_at`이 2026-04-10 04:44:52에 멈춰 있어 09:00 KST 이후 결제완료 원장을 확정할 수 없음 → Toss sync 상태와 배치 주기를 먼저 확인한다.
- 소스 혼동 위험 → Toss 직접 API에는 23시대 승인 주문이 조회되지만 `tb_sales_toss`에는 아직 없음 → 현 상태 승격 로직은 직접 Toss API가 아니라 `tb_sales_toss`를 정본으로 읽는다는 점을 문서와 운영 판단에서 분리한다.
- 최근 7일 수정 전 위험 후보 3그룹이 남아 있음 → Meta ROAS 과대 원인의 과거 흔적이 계속 보일 수 있음 → post-fix 구간과 최근 7일 구간을 문서와 화면에서 반드시 분리해 읽는다.
- payment_success 식별자 all-three coverage가 아직 18.82% 수준 → GA4/Meta 매칭 품질이 낮아 Attribution 해석이 계속 흔들릴 수 있음 → 결제완료 caller에서 `ga_session_id`, `client_id`, `user_pseudo_id`, `_fbc`, `_fbp` 유입을 계속 올린다.

5. 증빙

호출 1:

```text
GET /api/meta/capi/log?limit=500&scope=recent_operational&since=2026-04-10T00:00:00.000Z&include_dedup_candidates=1&dedup_candidate_limit=10
```

핵심 응답:

```text
total: 0
success: 0
operational/manual/test: 0 / 0 / 0
duplicateEventIds: 0
duplicateOrderEventGroups: 0
retryLikeGroups: 0
retryLikeRows: 0
multiEventIdGroups: 0
multiEventIdRows: 0
dedupCandidateDetails: []
```

post-fix 후보가 0건인 원인:

```text
GET /api/attribution/ledger?limit=200&source=biocom_imweb&captureMode=live

기준: loggedAt >= 2026-04-10T00:00:00.000Z
postFixRows: 33
paymentStatus: pending 33 / confirmed 0 / canceled 0
approvedAtPresent: 0
snippetVersion: 2026-04-08-fetchfix 33
ga_session_id + client_id + user_pseudo_id all-three: 33 / 33
```

코드 확인:

```text
backend/src/metaCapi.ts

selectMetaCapiSyncCandidates 조건:
touchpoint === "payment_success"
captureMode === "live"
paymentStatus === "confirmed"
```

따라서 현재 `post-fix CAPI dedup 후보 0건`의 직접 원인은 “결제완료 수집이 멈춤”이 아니라 “post-fix 결제완료 행이 아직 confirmed 후보가 아님”이다. 원장 최신 행에는 `ga_session_id`, `client_id`, `user_pseudo_id`가 모두 들어오고 있어 식별자 수집은 개선 신호가 있지만, 결제 확정값 보강 전에는 CAPI 전송과 dedup 효과를 검증할 수 없다.

pending으로 남는 원인 증빙:

```text
GET /api/attribution/ledger?limit=200&source=biocom_imweb&captureMode=live

기준: loggedAt >= 2026-04-10T00:00:00.000Z
postFixRows: 33
paymentStatus: pending 33
withPaymentKey: 29
withReferrerPayment: 29
withTossSyncSource: 0
approvedAtPresent: 0
```

```text
POST /api/attribution/sync-status/toss?dryRun=true&limit=200

totalCandidates: 200
matchedRows: 0
updatedRows: 0
skippedNoMatchRows: 200
대표 reason: toss row not found
```

```text
Postgres tb_sales_toss 직접 확인

total: 7501
max_approved_at: 2026-04-10 04:44:52
approved_at = 2026-04-10: 8
approved_at >= 2026-04-10: 8
post-fix 샘플 paymentKey 6개 매칭: 0
```

`tb_sales_toss.approved_at` 수신 방식:

```text
backend/src/routes/attribution.ts

SELECT
  payment_key AS "paymentKey",
  order_id AS "orderId",
  approved_at AS "approvedAt",
  status,
  channel,
  store,
  total_amount AS "totalAmount"
FROM tb_sales_toss
...
```

```text
동작 흐름:

1. 운영 Postgres DATABASE_URL에 연결한다.
2. tb_sales_toss를 read-only로 조회한다.
3. payment_key 또는 order_id가 pending 원장과 같으면 매칭한다.
4. status가 DONE/PAID면 confirmed로 승격한다.
5. approved_at 문자열은 normalizeApprovedAtToIso로 변환해 attribution ledger의 approvedAt에 저장한다.
```

`tb_sales_toss` 최신 행:

```text
payment_key: iw_bi20260410044404uISt3
order_id: 202604108566101-P1
approved_at: 2026-04-10 04:44:52
status: DONE
channel: toss_card
store: biocom
total_amount: 245000
```

날짜별 최신성:

```text
2026-04-10: 8건, max_approved_at 2026-04-10 04:44:52
2026-04-09: 76건, max_approved_at 2026-04-09 23:49:14
2026-04-08: 94건, max_approved_at 2026-04-08 23:48:43
2026-04-07: 67건, max_approved_at 2026-04-07 23:53:28
```

Toss 직접 API 반증:

```text
GET /api/toss/payments/orders/202604101193543-P1?store=biocom
status: DONE
approvedAt: 2026-04-10T23:34:21+09:00
paymentKey: iw_bi20260410233329sWLu6
totalAmount: 216099

GET /api/toss/payments/orders/202604102354644-P1?store=biocom
status: DONE
approvedAt: 2026-04-10T23:46:08+09:00
paymentKey: iw_bi20260410234511wpDe2
totalAmount: 35000
```

15분 주기/타임존 확인:

```text
SEO backend:
backend/src/bootstrap/startBackgroundJobs.ts
attributionStatusSyncIntervalMs = 15 * 60 * 1000
역할: tb_sales_toss를 읽어 attribution ledger의 pending을 confirmed/canceled로 승격
주의: tb_sales_toss 자체를 upsert하지 않음
```

```text
Revenue backend:
POST /api/scheduler/sales/toss-sync?month=YYYY-MM
app.tasks.tossApi.batch.sync_toss_sales
fetch_all_transactions(secret_key, start_date, end_date)
fetch_payment_details_batch(secret_key, payment_keys)
_payment_detail_to_row(detail, store, mid)
upsert_toss(db, all_rows) -> tb_sales_toss
```

```text
Revenue 변환 코드:
detail.approvedAt -> datetime.fromisoformat(...).astimezone(KST)
-> approved_at = dt.strftime("%Y-%m-%d %H:%M:%S")
```

```text
같은 주문 대조:
tb_sales_toss order_id: 202604108566101-P1
tb_sales_toss approved_at: 2026-04-10 04:44:52
Toss 직접 API approvedAt: 2026-04-10T04:44:52+09:00
판정: 한국시각 KST를 timezone 없는 문자열로 저장한 값
```

해석:

- 결제완료 receiver는 `paymentStatus`/`approvedAt`을 직접 확정하지 않는다. payload에 값이 없으면 `payment_success`는 기본 `pending`으로 저장된다.
- `confirmed` 승격은 `tb_sales_toss`에서 같은 `paymentKey` 또는 `orderId`를 찾아야 일어난다.
- 현재 post-fix 결제키가 `tb_sales_toss`에 없으므로 승격이 0건이다.
- biocom 아임웹 주문 캐시는 `lastOrderAt KST: 2026-04-10 22:04:44`까지 최신화되어 있지만, Toss 확정 테이블은 post-fix 시간대까지 최신화되어 있지 않다.
- Toss 직접 API에는 post-fix 결제가 보이므로, 운영 DB `tb_sales_toss` 적재 배치나 동기화 주기가 지연/중단됐을 가능성이 높다.
- `2026-04-10 04:44:52`는 UTC가 아니라 KST다. UTC로 환산하면 2026-04-09 19:44:52 UTC다.
- “15분마다 돈다”는 것은 SEO의 원장 상태 승격 job 기준이고, `tb_sales_toss` 생산자 동기화 주기 확인값이 아니다.
- 따라서 지금 할 일은 CAPI dedup 로직을 더 바꾸는 것이 아니라, Toss 확정 동기화가 왜 2026-04-10 04:44:52 이후로 갱신되지 않았는지 확인하는 것이다.

실제로 15분 단위로 주문 상태를 갱신하려면:

```text
핵심 결론

15분 갱신은 두 단계가 모두 살아 있어야 한다.

1. 생산자: Toss 결제 확정 데이터를 운영 Postgres tb_sales_toss에 최신 적재한다.
2. 소비자: SEO 백엔드가 tb_sales_toss를 읽어 attribution ledger의 pending 주문을 confirmed/canceled로 승격한다.

현재 확인된 상태는 2번만 15분 주기로 존재하고, 1번의 15분 주기는 확인되지 않았다.
```

권장 해결안 1: revenue 쪽 `tb_sales_toss` 생산자 sync를 15분마다 보장한다.

```text
무엇을 해야 하나

revenue 프로젝트의 Toss 매출 동기화 경로를 실제 15분 스케줄러에 연결한다.

대상 경로:
POST /api/scheduler/sales/toss-sync?month=YYYY-MM

현재 코드상 역할:
1. Toss 거래 목록을 월 단위로 조회한다.
2. 결제키별 상세 결제 API를 조회한다.
3. approvedAt을 KST 문자열로 변환한다.
4. 운영 Postgres tb_sales_toss에 upsert한다.
```

```text
왜 필요한가

SEO의 15분 Attribution status sync는 tb_sales_toss를 읽기만 한다.
tb_sales_toss 자체가 최신 결제를 갖고 있지 않으면, SEO job이 아무리 15분마다 돌아도 pending을 confirmed로 바꿀 수 없다.

현재 증거:
- 결제완료 원장에는 2026-04-10 09:00 KST 이후 33건이 들어와 있다.
- Toss 직접 결제 상세 API에는 2026-04-10 23시대 DONE 결제가 조회된다.
- 하지만 tb_sales_toss 최신 approved_at은 2026-04-10 04:44:52 KST에 멈춰 있다.
```

```text
어떻게 해야 하나

1. revenue 운영 환경에서 Cloud Scheduler 또는 서버 cron이 아래 API를 15분마다 호출하는지 확인한다.
   POST /api/scheduler/sales/toss-sync?month=2026-04

2. 스케줄러가 없거나 일 단위라면 15분 주기로 추가한다.
   예: 매 15분마다 현재 KST 월을 대상으로 실행.

3. 월말/월초 경계에서는 현재 월 + 직전 월을 같이 돌린다.
   예: 2026-05-01 00:05 KST에는 2026-05와 2026-04를 모두 동기화.

4. revenue API가 month를 필수로 받는 구조라면 운영 스케줄러가 매월 자동으로 month 값을 바꾸도록 만들거나, endpoint에서 month 미지정 시 현재 KST 월을 기본값으로 처리하게 수정한다.

5. sync 직후 아래 조건을 모니터링한다.
   tb_sales_toss.max(approved_at)이 영업 시간 중 현재 KST보다 30~60분 이상 늦으면 알림.
   tb_sales_toss.max(synced_at 또는 updated_at)이 30분 이상 갱신되지 않으면 알림.
```

주의할 점:

```text
현재 /api/toss/transactions?store=biocom&startDate=2026-04-10&endDate=2026-04-10 조회는 0건으로 관측됐고,
반대로 /api/toss/payments/orders/{orderId} 직접 결제 상세 조회는 2026-04-10 23시대 결제를 DONE으로 반환했다.

따라서 revenue의 월 단위 sync가 Toss 거래 목록 API에만 의존한다면, 날짜 파라미터/타임존/조회 범위 문제 때문에 당일 결제가 누락될 수 있다.
15분 최신화를 적용하기 전 반드시 수동으로 2026-04 current-month sync를 실행한 뒤 tb_sales_toss.max(approved_at)이 23시대까지 올라오는지 확인해야 한다.
올라오지 않으면 거래 목록 API 조회 조건을 먼저 고치거나, 결제완료 원장의 paymentKey/orderId 기준 직접 결제 상세 API fallback을 추가해야 한다.
```

권장 해결안 2: SEO status sync에 직접 Toss API fallback을 추가한다.

```text
무엇을 해야 하나

SEO의 syncAttributionPaymentStatusesFromToss 단계에서 tb_sales_toss 매칭이 실패한 pending 행에 한해,
paymentKey 또는 orderId로 Toss 직접 결제 상세 API를 조회하는 fallback을 넣는다.
```

```text
왜 필요한가

revenue 쪽 tb_sales_toss 생산자 sync가 늦어지면 Attribution/CAPI도 같이 멈춘다.
지금처럼 결제완료 원장에는 paymentKey가 있는데 tb_sales_toss에 아직 없는 경우, 직접 Toss API로는 DONE 여부를 확인할 수 있다.
이 fallback은 Meta CAPI dedup 검증을 빠르게 재개하고, 운영 ROAS가 pending에 묶여 낮게 보이는 시간을 줄인다.
```

```text
어떻게 해야 하나

1. pending payment_success 중 tb_sales_toss 매칭 실패 행만 대상으로 한다.
2. paymentKey가 있으면 /v1/payments/{paymentKey}를 우선 조회한다.
3. paymentKey가 없고 orderId가 있으면 /v1/payments/orders/{orderId}를 조회한다.
4. status가 DONE 또는 PAID면 attribution ledger를 confirmed로 승격하고 approvedAt/totalAmount/paymentKey를 보강한다.
5. 취소 상태면 canceled로 반영한다.
6. READY, IN_PROGRESS, WAITING_FOR_DEPOSIT 등 확정 전 상태면 pending 유지한다.
7. 15분 job당 조회 limit과 rate limit을 둔다. 예: 최신 pending 100건 이내.
8. direct fallback으로 승격한 행에는 source를 `toss_direct_api_fallback`처럼 남겨 나중에 tb_sales_toss 기반 승격과 구분한다.
```

운영 판단:

```text
정본 테이블을 유지하려면 권장 해결안 1이 우선이다.
하지만 Attribution/CAPI가 tb_sales_toss 지연에 막히지 않게 하려면 권장 해결안 2를 병행하는 것이 안전하다.

즉 최종 구조는 아래가 맞다.

1. revenue: tb_sales_toss를 15분마다 최신화한다.
2. SEO: tb_sales_toss를 15분마다 읽어 pending을 승격한다.
3. SEO: tb_sales_toss에 아직 없는 최신 주문은 Toss 직접 API fallback으로 임시 승격한다.
4. CAPI auto_sync: confirmed가 된 결제완료만 Meta로 보낸다.
```

성공 기준:

```text
1. revenue sync 직후 tb_sales_toss.max(approved_at)이 2026-04-10 04:44:52에서 최신 시간대로 전진한다.
2. /api/attribution/sync-status/toss?dryRun=true&limit=200에서 skippedNoMatchRows가 줄고 matchedRows가 생긴다.
3. post-fix 33건 pending 중 DONE 결제가 confirmed로 바뀐다.
4. 다음 CAPI auto_sync 이후 /api/meta/capi/log?scope=recent_operational&since=2026-04-10T00:00:00.000Z에 운영 로그가 생긴다.
5. 그 post-fix 운영 로그에서 multiEventIdGroups가 0인지 다시 판단한다.
```

호출 2:

```text
GET /api/meta/capi/log?limit=500&scope=recent_operational&since_days=7&include_dedup_candidates=1&dedup_candidate_limit=10
```

핵심 응답:

```text
total: 691
success: 691
operational/manual/test: 691 / 0 / 0
uniqueEventIds: 428
duplicateEventIds: 263
duplicateEventIdGroups: 174
duplicateOrderEventGroups: 173
retryLikeGroups: 170
retryLikeRows: 427
multiEventIdGroups: 3
multiEventIdRows: 12
latest log: 2026-04-09T21:26:08.834Z, 한국시간 2026-04-10 06:26:08 KST
```

최근 7일의 `multiEventIdGroups` 3개는 모두 수정 전 auto_sync 흔적이다.

| orderId | rows | unique event_id | paymentKey | approvedAt | loggedAt 차이 | sendPath | 판정 |
|---|---:|---:|---|---|---|---|---|
| 202604083892378 | 6 | 2 | 동일 | 2026-04-08 10:27:59 KST | 다름 | auto_sync | 수정 전 위험 후보 |
| 202604066709345 | 4 | 2 | 동일 | 2026-04-06 15:22:00 KST | 다름 | auto_sync | 수정 전 위험 후보 |
| 202604023345485 | 2 | 2 | 동일 | 2026-04-02 14:18:06 KST | 다름 | auto_sync | 수정 전 위험 후보 |

호출 3:

```text
GET /api/attribution/caller-coverage
```

핵심 응답:

```text
payment_success total: 680
withGaSessionId: 132
withClientId: 129
withUserPseudoId: 129
withAllThree: 128
allThreeRate: 18.82%
```

참고로 biocom만 따로 보면 다음과 같다.

```text
GET /api/attribution/caller-coverage?source=biocom_imweb

payment_success total: 598
withGaSessionId: 118
withClientId: 114
withUserPseudoId: 114
withAllThree: 114
allThreeRate: 19.06%
```

호출 4:

```text
GET /api/crm-local/imweb/order-stats?site=biocom
```

핵심 응답:

```text
totalOrders: 8240
memberOrders: 6589
phoneCustomers: 6415
paymentAmountSum: 2816166680
firstOrderAt: 2026-01-07T14:24:14.000Z
lastOrderAt: 2026-04-10T13:04:44.000Z
lastOrderAt KST: 2026-04-10 22:04:44 KST
lastSyncedAt: 2026-04-10 14:22:43
```

호출 5:

```text
GET /api/crm-local/imweb/toss-reconcile?site=biocom&lookbackDays=90&limit=5
```

핵심 응답:

```text
imwebOrders: 8037
tossOrders: 5839
matchedOrders: 5820
missingInToss: 2217
missingInImweb: 19
amountMismatchCount: 44
coverageRate: 72.42%
0-1일 coverageRate: 2.8%
2-7일 coverageRate: 60.37%
8-30일 coverageRate: 73.36%
31일 이상 coverageRate: 77.32%
```

보조 해석: post-fix dedup 후보가 0건이라 Toss 1:1 대조로 위험 주문을 닫을 대상은 없었다. 다만 biocom 아임웹 캐시는 최신화되어 최신 주문 구간까지 조회 가능하다.

skip guard 확인:

- 코드상 `syncMetaConversionsFromLedger`는 이미 성공한 운영 `orderId/paymentKey + eventName` 조합을 `duplicate_order_event_success`로 skip하도록 구현되어 있다.
- 하지만 post-fix 운영 auto_sync 전송 로그가 0건이고 post-fix 원장 행도 아직 `pending`이므로, 이번 실행에서는 그 guard가 실제 운영에서 skip을 발생시켰는지 확인할 로그가 없다.
- 이 항목도 다음 auto_sync 이후 확인 대상이다.

식별자 품질을 높이기 위한 구체 액션:

- 1순위: biocom 결제완료 페이지에 최신 스니펫 `2026-04-08-fetchfix`가 계속 적용되는지 모니터링한다. post-fix 샘플 33건은 모두 해당 버전이고 all-three 100%라 방향은 맞다. 다만 전체 누적 coverage는 과거 누락분 때문에 18~19%대라, 앞으로는 `snippetVersion`별 24시간 coverage를 따로 봐야 한다.
- 2순위: `checkout_started` 수집을 실제 주문 전 단계에 붙인다. 2026-04-10 시간대 비교에서 `payment_success`는 51건인데 `checkoutEntries`는 0건이다. 결제완료 페이지는 PG/아임웹 백페이지를 거친 뒤라 GA 쿠키와 dataLayer가 늦게 잡히거나 사라질 수 있으므로, 결제 버튼 클릭 또는 PG 이동 직전에 식별자를 먼저 저장해야 한다.
- 3순위: 랜딩/상품/장바구니 단계에서 `ga_session_id`, `client_id`, `user_pseudo_id`, `_fbc`, `_fbp`를 로컬 저장소에 보존하고 결제완료 페이지가 이를 재사용하게 한다. 현재 스니펫은 `_p1s1a_last_touch`, `__bs_imweb_session`, GA cookie, `gtag('get')`를 읽지만, 상위 단계에서 안정적으로 저장되지 않으면 결제완료 페이지 단독으로는 한계가 있다.
- 4순위: 결제완료 페이지에서 식별자 수집을 1회 즉시 전송이 아니라 짧은 재시도 방식으로 바꾼다. 예를 들어 최초 로드 직후, 500ms, 1500ms에 최대 2~3회 식별자를 다시 읽고 가장 완전한 값을 한 번만 `/api/attribution/payment-success`로 전송한다. 이때 주문번호 기준 dedupe marker는 유지해야 중복 원장 적재를 막을 수 있다.
- 5순위: 외부 GTM 오류를 수정한다. 이전에 확인된 `GTM-W7VXS4D8`의 null `.includes`류 오류가 결제완료 페이지에서 스크립트 흐름을 깨면, 우리 스니펫이 맞아도 식별자 회수가 불안정해진다. 개발팀은 GTM 태그 예외 처리를 넣고, 리인벤팅 CRM 외주사에는 결제완료 페이지에서 dataLayer/GA 값이 사라지지 않도록 요청해야 한다.
- 6순위: 디버그 필드를 추가한다. 각 원장 행에 `gaSessionIdSource`, `clientIdSource`, `userPseudoIdSource`, `fbcSource`, `fbpSource`를 남기면 “쿠키에서 읽었는지, gtag에서 읽었는지, 저장소 fallback인지”를 바로 구분할 수 있다. 지금처럼 aggregate coverage만 보면 어디가 막히는지 찾는 데 시간이 오래 걸린다.
- 7순위: 목표치를 분리한다. 전체 누적 coverage는 과거 누락분 때문에 천천히 오른다. 운영 판단은 최근 24시간/7일, source=biocom_imweb, snippetVersion=2026-04-08-fetchfix 기준으로 보고, 목표는 우선 all-three 70% 이상, Meta click 유입은 `_fbc`/`_fbp` 포함률 별도 70% 이상으로 잡는 게 현실적이다.

검증 명령:

```text
cd backend && npm run typecheck
```

결과:

```text
성공
```

6. 최종 제안

하루 더 로그를 기다리는 것을 추천한다.

지금 바로 운영 반영 완료로 닫으면 안 된다. post-fix 이후 운영 CAPI 전송 로그가 아직 0건이고, post-fix 원장 행은 모두 pending이라 CAPI 후보가 아니다. 직접 원인은 Toss 확정 테이블이 post-fix 구간 결제키를 아직 갖고 있지 않기 때문이다. 더 정확히는 Toss 직접 API에는 최신 결제가 있지만, 현재 상태 승격 로직이 읽는 운영 Postgres `tb_sales_toss`가 2026-04-10 04:44:52 이후로 아직 갱신되지 않았다. 다음 Toss 확정 동기화와 auto_sync 이후 같은 CAPI log 쿼리에서 `total > 0`인 상태로 `multiEventIdGroups`와 `multiEventIdRows`가 0 또는 무시 가능한 수준인지 확인한 뒤 닫는 게 맞다.

식별자 품질은 별도 축으로 계속 진행한다. 최신 스니펫 행만 보면 개선 신호가 있으므로, 다음 작업은 결제완료 페이지 단독 보강보다 `checkout_started` 선행 수집, 랜딩/장바구니 단계 저장, 짧은 재시도 전송, `snippetVersion`별 coverage 모니터링 순서가 맞다.
