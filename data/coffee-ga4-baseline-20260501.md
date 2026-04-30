# 더클린커피 GA4 BigQuery 기준선 리포트

작성 시각: 2026-05-01 00:52 KST
site: `thecleancoffee`
phase: `read_only`
분석 window: 2026-04-23 00:00 KST ~ 2026-04-29 23:59 KST
BigQuery window: `events_20260423` ~ `events_20260429`
Primary source: GA4 BigQuery `project-dadba7dd-0229-4ff6-81c.analytics_326949178`
Cross-check: 운영 Postgres `public.tb_sales_toss`, `public.tb_playauto_orders`, 기존 `reconcile-coffee-ga4-toss.ts` read-only 결과
Freshness: `check-source-freshness.ts --json`, 2026-05-01 00:50 KST 실행 기준 `events_20260429` fresh, latest event `2026-04-29 23:57:37 KST`
Confidence: 84%

## 10초 요약

더클린커피는 GA4 BigQuery read-only 기준선 분석이 가능하다. 최근 7일 GA4 purchase는 108건, distinct transaction_id도 108건이고, transaction_id/user/session 누락은 0건이다.

다만 NPay로 보이는 58건은 아직 실제 NPay 주문 원장과 확정 매칭한 것이 아니다. transaction_id가 `NPAY - ...` 패턴이고 product/cart page에서 purchase로 잡힌 건이라, Naver Commerce API 또는 NPay 주문/정산 원장으로 actual order를 확인하기 전까지는 전송 복구 판단에 쓰면 안 된다.

첫 결론은 `BigQuery-first read-only 계속 진행`이다. Toss 계열 non-NPay는 GA4와 Toss 운영 원장 매칭 품질이 높고, NPay는 별도 actual order 권한 확인이 핵심 blocker다.

## Auditor Verdict

```text
Auditor verdict: PASS_WITH_NOTES
Phase: coffee_bigquery_read_only
No-send verified: YES
No-write verified: YES
No-deploy verified: YES
Candidate guard verified: N/A
Numbers current: YES
Unrelated dirty files excluded: YES
No-send grep matched docs only: YES
New executable send path added: NO
Actual network send observed: NO
Notes:
- 이 작업은 BigQuery/운영 Postgres read-only 조회와 문서/스크립트 작성만 수행했다.
- GA4 NPay형 purchase 58건은 actual NPay order confirmed가 아니다.
- coffee Naver Commerce API 권한 확인 전 NPay purchase 복구/전송은 금지다.
```

## 실행 명령

```bash
cd backend
npm exec tsx scripts/check-source-freshness.ts -- --json
npm exec tsx scripts/reconcile-coffee-ga4-toss.ts -- --startSuffix=20260423 --endSuffix=20260429 --store=coffee --json
npm exec tsx scripts/coffee-ga4-baseline.ts -- --startSuffix=20260423 --endSuffix=20260429 --json
```

## Source Freshness

| source | 상태 | 기준 | 값 | 판단 |
|---|---|---|---|---|
| `ga4_bigquery_thecleancoffee` | fresh | `events_20260429` | rows 2,228, purchase 21, distinct txn 21 | primary 가능 |
| `toss_operational` | watch | `tb_sales_toss` | latest approved `2026-04-30 03:27:08 KST`, synced `2026-04-29 21:00:30 KST` | read-only cross-check 가능 |
| `playauto_operational` | watch | `tb_playauto_orders` | latest pay `2026-04-29 17:14:11 KST`, synced `2026-04-29 20:00:08 KST` | read-only cross-check 가능 |
| `imweb_local_orders` | stale | local SQLite | latest complete around `2026-04-15` | primary 금지 |
| `toss_local_transactions` | stale | local SQLite | latest event `2026-04-23` | primary 금지 |
| `attribution_ledger` | data_sparse | local SQLite | latest `2026-04-12` | coffee live 판단 금지 |

## GA4 Purchase Summary

| 날짜 | purchase_events | distinct_transaction_ids | missing_transaction_id | missing_user_pseudo_id | missing_ga_session_id | revenue |
|---|---:|---:|---:|---:|---:|---:|
| 2026-04-23 | 17 | 17 | 0 | 0 | 0 | 729,637 |
| 2026-04-24 | 9 | 9 | 0 | 0 | 0 | 293,276 |
| 2026-04-25 | 9 | 9 | 0 | 0 | 0 | 421,981 |
| 2026-04-26 | 11 | 11 | 0 | 0 | 0 | 504,422 |
| 2026-04-27 | 23 | 23 | 0 | 0 | 0 | 908,885 |
| 2026-04-28 | 18 | 18 | 0 | 0 | 0 | 838,792 |
| 2026-04-29 | 21 | 21 | 0 | 0 | 0 | 757,531 |
| 합계 | 108 | 108 | 0 | 0 | 0 | 4,454,524 |

해석:

GA4 purchase row 자체의 기본 품질은 좋다. 최근 7일 기준 transaction_id, user_pseudo_id, ga_session_id 누락은 0건이다.

주의:

purchase event-level `collected_traffic_source`는 108건 모두 source/gclid가 비어 있었다. 대신 `session_traffic_source_last_click`은 108건 모두 채워져 있었다. 따라서 커피 ROAS 분석은 event-level source가 아니라 session last click 기준을 우선 사용해야 한다.

## Payment Method 분리

현재 GA4 event_params에 명시적인 `payment_method` 값은 없다. 따라서 1차 분류는 transaction_id 패턴 기준이다.

| 분류 | purchase_events | distinct_transactions | revenue | 해석 |
|---|---:|---:|---:|---|
| `npay_transaction_id` | 58 | 58 | 2,359,300 | transaction_id가 `NPAY - ...` 패턴 |
| `non_npay_ga4` | 50 | 50 | 2,095,224 | Toss/일반 결제 후보 |

중요:

`npay_transaction_id` 58건은 GA4에 purchase 형태로 들어온 건이다. actual NPay 주문이 확정됐다는 뜻은 아니다. NPay actual order는 Naver Commerce API, NPay 정산/주문 엑셀, 또는 Imweb 주문 원장과 별도 대조해야 한다.

## GA4 ↔ Toss 운영 원장 대조

실행: `reconcile-coffee-ga4-toss.ts`, store `coffee`, window `20260423~20260429`

| 지표 | 값 |
|---|---:|
| GA4 transactions | 108 |
| GA4 purchase events | 108 |
| GA4 gross | 4,454,524 |
| GA4 NPay형 transactions | 58 |
| GA4 NPay형 gross | 2,359,300 |
| GA4 Toss 후보 transactions | 50 |
| GA4 Toss 후보 gross | 2,095,224 |
| Toss confirmed transactions in window | 49 |
| Toss confirmed gross/net | 2,124,865 |
| GA4 Toss 후보 중 confirmed match | 46 |
| Toss 후보 기준 match rate | 92.00% |
| matched GA4 gross | 1,982,622 |
| matched Toss confirmed gross/net | 1,982,622 |
| matched gross/net diff | 0 |
| GA4-only non-NPay | 1건, 36,500 |
| Toss canceled인데 GA4 purchase 존재 | 3건 |
| Toss-only confirmed | 3건 |

해석:

Toss/일반 결제 후보는 GA4와 운영 Toss 원장의 금액 정합성이 좋다. 46건은 금액 차이 0원으로 matched다.

남은 차이는 운영 판단이 필요하다.

| 차이 | 의미 | 다음 확인 |
|---|---|---|
| GA4-only non-NPay 1건 | GA4에는 있지만 Toss confirmed에 없음 | PlayAuto/Imweb 주문 원장 확인 |
| Toss canceled 3건이 GA4 purchase에 있음 | 결제 취소가 GA4 purchase로 남아 있을 수 있음 | refund/cancel event 또는 purchase 취소 처리 확인 |
| Toss-only confirmed 3건 | Toss에는 있는데 GA4 purchase 없음 | GA4 누락 또는 transaction_id 차이 robust search |

## 운영 주문 원장 후보

| source | window | 값 |
|---|---|---:|
| `tb_sales_toss`, `store=coffee`, `status=DONE` | 2026-04-23 ~ 2026-04-29 | 49 transactions, gross/net 2,124,865 |
| `tb_sales_toss`, `store=coffee`, `status=CANCELED` | 2026-04-23 ~ 2026-04-29 | 3 transactions, gross 76,102, net 0 |
| `tb_playauto_orders`, `shop_name='아임웹-C'` | 2026-04-23 ~ 2026-04-29 | 152 rows, 105 distinct order keys |

판단:

1. Toss 운영 원장은 non-NPay 결제 cross-check에 쓸 수 있다.
2. PlayAuto는 실제 주문 원장 후보지만 행 단위가 주문/상품 단위로 펼쳐져 있을 수 있다.
3. NPay actual order는 아직 이 표만으로 확정하지 않는다.

## Source / Medium 상위

| source_medium | purchase_events | revenue | 판단 |
|---|---:|---:|---|
| Unassigned / `naver_brand_search` / `naver_brand_search` | 47 | 1,989,676 | 내부 채널 매핑 필요. 사실상 네이버 브랜드 검색 후보 |
| Direct / `(direct)` / `(none)` | 18 | 791,502 | 직접 유입 |
| Organic Search / `m.search.naver.com` / referral | 11 | 421,925 | 네이버 모바일 검색/리퍼럴 |
| Paid Social / `meta` / `paid_social` | 7 | 193,900 | Meta 광고 |
| Unassigned / `channel_talk` / campaign | 5 | 244,029 | CRM/상담 메시지 계열로 분리 권장 |
| Organic Social / `kakao` / message | 3 | 135,216 | 카카오 메시지 계열 |
| Organic Search / `google` / organic | 3 | 123,900 | Google 자연검색 |
| Unassigned / `kakakotalk` / plusfriend | 2 | 76,433 | 오탈자/카카오 채널 후보, 매핑 확인 필요 |

해석:

GA4 기본 채널에서 `Unassigned`가 크다. 특히 `naver_brand_search` 47건은 ROAS 판단 전에 내부 채널 매핑을 먼저 해야 한다.

## Page Location 상위

| page_location | purchase_events | revenue | 해석 |
|---|---:|---:|---|
| `/thecleancoffee_store/?idx=4` | 19 | 683,300 | 콜롬비아 상품 상세 후보 |
| `/shop_cart` | 15 | 895,000 | 장바구니에서 NPay형 purchase가 잡히는 흐름 가능 |
| `/thecleancoffee_store/?idx=12` | 7 | 294,100 | 디카페인/파푸아뉴기니 후보 |
| `/thecleancoffee_store/?idx=30` | 6 | 177,200 | 과테말라 후보 |
| `/thecleancoffee_store/?idx=1` | 4 | 128,800 | 에티오피아 후보 |
| `/thecleancoffee_store/?idx=66` | 2 | 84,000 | 드립백 선물세트 후보 |
| `/thecleancoffee_store/?idx=24` | 2 | 21,800 | 드립백 커피 후보 |

주의:

NPay형 purchase가 product page나 cart page에서 잡히는 패턴이 보인다. 이것이 실제 결제 완료인지, NPay 버튼/데이터레이어 이벤트인지 actual order 원장으로 확인해야 한다.

## Item 상위

| item_id | item_name | rows | distinct_transactions | item_revenue_estimate |
|---|---|---:|---:|---:|
| 4 | 콜롬비아 스페셜티 200g / 500g | 21 | 19 | 683,300 |
| 4 | 콜롬비아 스페셜티 500g 홀빈 옵션 | 15 | 15 | 502,500 |
| 4 | 콜롬비아 스페셜티 공백 변형 | 9 | 9 | 235,700 |
| 4 | 콜롬비아 스페셜티 200g 홀빈 옵션 | 9 | 9 | 164,700 |
| 12 | 파푸아뉴기니 디카페인 공백 변형 | 8 | 8 | 252,700 |
| 30 | 과테말라 SHB 스페셜티 | 8 | 7 | 196,500 |
| 12 | 파푸아뉴기니 디카페인 | 7 | 7 | 294,100 |

해석:

상품명 변형이 많다. NPay/주문 매칭에서 product_name exact만 쓰면 ambiguous가 늘어날 수 있다. `item_id`와 normalized product name을 같이 써야 한다.

## Robust Search Query 초안

특정 order_number 또는 channel_order_no가 GA4 raw에 있는지 확인할 때 쓴다.

```sql
DECLARE ids ARRAY<STRING> DEFAULT ['ORDER_NUMBER_HERE', 'CHANNEL_ORDER_NO_HERE'];

SELECT
  _TABLE_SUFFIX AS table_suffix,
  event_name,
  FORMAT_TIMESTAMP('%Y-%m-%d %H:%M:%S %Z', TIMESTAMP_MICROS(event_timestamp), 'Asia/Seoul') AS event_time_kst,
  ecommerce.transaction_id AS ecommerce_transaction_id,
  (SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'transaction_id') AS param_transaction_id
FROM `project-dadba7dd-0229-4ff6-81c.analytics_326949178.events_*`
WHERE _TABLE_SUFFIX BETWEEN '20260423' AND '20260429'
  AND (
    ecommerce.transaction_id IN UNNEST(ids)
    OR EXISTS (
      SELECT 1
      FROM UNNEST(event_params) ep
      WHERE COALESCE(ep.value.string_value, CAST(ep.value.int_value AS STRING), CAST(ep.value.double_value AS STRING), CAST(ep.value.float_value AS STRING)) IN UNNEST(ids)
    )
  )
ORDER BY event_timestamp DESC;
```

## Coffee Dry-run Schema 초안

| 컬럼 | 설명 |
|---|---|
| `site` | `thecleancoffee` |
| `ga4_transaction_id` | GA4 transaction_id |
| `payment_method_guess` | `npay_transaction_id`, `non_npay_ga4`, `unknown` |
| `order_number` | 운영/Imweb 주문번호 후보 |
| `channel_order_no` | NPay 외부 주문번호 후보 |
| `ga4_event_time_kst` | GA4 purchase 시각 |
| `order_paid_at_kst` | 운영 원장 결제 시각 |
| `page_location` | purchase 발생 페이지 |
| `source_key`, `medium_key`, `channel_group` | session last click 기준 유입 |
| `item_id`, `item_name_normalized` | 상품 매칭 키 |
| `order_payment_amount` | 최종 결제금액 |
| `item_total` | 상품 합계 |
| `delivery_price` | 배송비 |
| `discount_amount` | 할인/포인트 |
| `amount_match_type` | `final_exact`, `shipping_reconciled`, `discount_reconciled`, `quantity_reconciled`, `cart_contains_item`, `none` |
| `match_grade` | `A_strong`, `B_strong`, `ambiguous`, `ga4_only`, `order_only` |
| `already_in_ga4` | coffee는 BigQuery primary이므로 기본 `present`; 복구 후보는 별도 actual order에서 찾음 |
| `send_candidate` | read-only phase에서는 항상 `N` |
| `block_reason` | `read_only_phase`, `npay_actual_order_unknown`, `already_in_ga4_present`, `ambiguous` 등 |

## 지금 판단

| 질문 | 답 |
|---|---|
| 더클린커피 BigQuery 기준선은 생성됐나 | YES |
| GA4 purchase transaction_id 품질은 좋은가 | YES, 108/108 |
| Toss/일반 결제 대조는 가능한가 | YES, 50 GA4 Toss 후보 중 46 confirmed exact match |
| NPay actual order까지 확정됐나 | NO |
| NPay intent live 배포가 필요한가 | 아직 NO. 먼저 NPay actual order 원장 권한 확인 |
| 광고 전송 복구를 열어도 되나 | NO |

## 다음 할일

| 순서 | 담당 | 할 일 | 왜 | 어떻게 |
|---:|---|---|---|---|
| 1 | Codex | GA4 NPay형 58건의 transaction_id 패턴을 더 분해 | 실제 주문번호/외부번호를 뽑을 수 있는지 확인 | `NPAY - ...` 구성요소와 event_params 전체 key 분석 |
| 2 | TJ | 더클린커피 Naver Commerce API 권한 확인 | NPay actual order truth가 필요 | coffee seller/API app scope 확인 |
| 3 | Codex | Toss 차이 7건 세부 리포트 작성 | GA4-only/canceled/Toss-only 원인 분리 | 1건 GA4-only, 3 canceled, 3 Toss-only를 order/page/source로 표기 |
| 4 | Codex | 상품명 normalization 규칙 초안 | item_name 변형 때문에 매칭이 흔들릴 수 있음 | `item_id + normalized_name` 기준 제안 |
| 5 | Codex | coffee dry-run schema를 코드/JSON 리포트로 고정 | 반복 분석 가능하게 만들기 | `coffee-ga4-baseline.ts` 결과를 markdown/JSON으로 표준화 |

## 금지 유지

- 운영 DB write 금지
- Excel actual import apply 금지
- coffee GTM publish 금지
- NPay intent live 배포 금지
- GA4/Meta/TikTok/Google Ads 전송 금지
- 운영 endpoint 배포 금지

## Eval Log

```yaml
run_id: "coffee-ga4-baseline-20260501-0052"
created_at_kst: "2026-05-01 00:52 KST"
created_by: "Codex"
phase: "read_only"
site: "thecleancoffee"
mode: "read_only"
window_kst:
  start: "2026-04-23 00:00 KST"
  end: "2026-04-29 23:59 KST"
sources:
  primary:
    name: "project-dadba7dd-0229-4ff6-81c.analytics_326949178"
    freshness_at_kst: "2026-04-29 23:57:37 KST"
    confidence: 0.92
  cross_checks:
    - name: "operational_postgres.public.tb_sales_toss"
      freshness_at_kst: "2026-04-29 21:00:30 KST synced, latest approved 2026-04-30 03:27:08 KST"
      confidence: 0.82
    - name: "operational_postgres.public.tb_playauto_orders"
      freshness_at_kst: "2026-04-29 20:00:08 KST synced, latest pay 2026-04-29 17:14:11 KST"
      confidence: 0.78
summary:
  ga4_purchase_events: 108
  ga4_distinct_transaction_ids: 108
  ga4_missing_transaction_id: 0
  ga4_purchase_revenue: 4454524
  ga4_npay_pattern_transactions: 58
  ga4_npay_pattern_revenue: 2359300
  ga4_non_npay_transactions: 50
  ga4_non_npay_revenue: 2095224
  toss_confirmed_transactions: 49
  toss_confirmed_gross: 2124865
  toss_matched_confirmed_transactions: 46
  toss_matched_gross_diff: 0
guardrails:
  no_send_verified: true
  no_db_write_verified: true
  no_deploy_verified: true
  approval_required: false
confidence: 0.84
```
