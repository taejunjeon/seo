# 더클린커피 Dry-run Schema v0

작성 시각: 2026-05-01 02:20 KST
site: `thecleancoffee`
phase: `read_only`
Primary source: Imweb v2 API, GA4 BigQuery `analytics_326949178`, 아임웹 주문/결제 엑셀
Freshness: 실행 시점별 리포트에 기록
Confidence: 88%

## 목적

더클린커피 정합성 작업에서 Codex/Claude/ChatGPT가 같은 컬럼과 같은 금지선을 쓰게 한다.

이 schema는 운영 전송용이 아니다. `send_candidate`는 read-only 단계에서 항상 `N`이다.

## NPay Actual vs GA4 Dry-run Row

| field | type | 의미 | 예시/규칙 |
|---|---|---|---|
| `site` | string | 사이트 식별자 | `thecleancoffee` |
| `order_number` | string | Imweb `order_no` | `202604...` |
| `channel_order_no` | string | Imweb에 들어온 NPay 외부 주문번호 | NPay 주문이면 채워짐 |
| `paid_at_kst` | string | Imweb 결제완료 시각 | KST |
| `order_payment_amount` | number | Imweb 최종 결제금액 | 배송비 포함 |
| `product_names` | string | PlayAuto 상품명 evidence | `아임웹-C` cross-check |
| `ga4_transaction_id` | string | GA4 후보 transaction_id | `NPAY - ...` |
| `ga4_event_time_kst` | string | GA4 purchase event 시각 | KST |
| `ga4_revenue` | number | GA4 purchase revenue | 원 |
| `time_gap_minutes` | number | Imweb paid_at과 GA4 event 차이 | 작을수록 좋음 |
| `amount_match_type` | enum | 금액 보정 유형 | 아래 표 참조 |
| `amount_delta` | number | 금액 차이 | 양수/음수 |
| `score` | number | 후보 점수 | 금액+시간+상품명 |
| `score_gap` | number | 1등과 2등 후보 점수 차이 | 작으면 ambiguous |
| `match_grade` | enum | 매칭 등급 | `A_strong`, `B_strong`, `probable`, `ambiguous`, `purchase_without_ga4` |
| `one_to_one_selected` | boolean | 전역 one-to-one 배정 여부 | 같은 GA4 event 중복 배정 방지 |
| `already_in_ga4` | enum | GA4 존재 상태 | `present_npay_pattern_candidate`, `robust_absent`, `unknown` |
| `send_candidate` | enum | 전송 후보 여부 | read-only에서는 항상 `N` |
| `block_reason` | string | 전송 금지 이유 | `read_only_phase`, `ambiguous` 등 |

## amount_match_type

| 값 | 의미 | 판단 |
|---|---|---|
| `final_exact` | GA4 revenue와 Imweb 최종 결제금액 일치 | 가장 강함 |
| `shipping_reconciled` | GA4 revenue가 배송비를 제외한 상품금액으로 보임 | dry-run 분류 가능, 실제 전송 전 별도 확인 |
| `discount_reconciled` | 할인/쿠폰/포인트 차이로 설명 가능 | dry-run 분류 가능 |
| `item_exact` | GA4 revenue와 상품합계 일치 | 배송비/장바구니 여부 확인 필요 |
| `near_exact` | 1,000원 이내 | 수동 검토 |
| `none` | 금액 차이가 설명되지 않음 | 전송 금지 |

## match_grade

| grade | 기준 | read-only 판단 |
|---|---|---|
| `A_strong` | score >= 90, time_gap <= 2분, 금액 보정 OK, 상품 overlap 있음 | 후보일 뿐 전송 금지 |
| `B_strong` | score >= 80, time_gap <= 10분, 금액 보정 OK | 후보일 뿐 전송 금지 |
| `probable` | score >= 65 | 수동 검토 |
| `ambiguous` | 후보가 여러 개거나 점수 차이가 낮음 | 전송 금지 |
| `purchase_without_ga4` | actual order는 있으나 GA4 후보 없음 | robust guard 필요 |

## BigQuery Guard Row

| field | 의미 |
|---|---|
| `id` | 조회한 `order_number` 또는 `channel_order_no` |
| `guard_status` | `present` 또는 `robust_absent` |
| `events` | GA4 raw 전체 event 매칭 수 |
| `purchase_events` | GA4 purchase 매칭 수 |
| `event_names` | 매칭된 event_name 목록 |
| `first_seen_kst` | 최초 raw event 시각 |
| `last_seen_kst` | 최종 raw event 시각 |
| `samples` | 최신 5개 raw event evidence |

조회 범위:

- `ecommerce.transaction_id`
- `event_params.transaction_id`
- `event_params` 전체 value string/int/double/float

## Excel Import Dry-run Row

| field | 의미 |
|---|---|
| `orders.rows` | 주문 엑셀 행수 |
| `orders.uniqueOrders` | 고유 주문번호 |
| `orders.amountByUniqueOrder` | 주문번호 단위 최종주문금액 합계 |
| `orders.uniquePhones` | 정규화 phone 고유 수 |
| `orders.channelSummary` | 판매채널별 주문/금액 |
| `orders.statusSummary` | 주문상태별 주문/금액 |
| `payments.rows` | 결제 엑셀 행수 |
| `payments.uniquePaymentOrders` | 결제 엑셀 고유 주문번호 |
| `payments.joinedOrders` | 주문 엑셀과 결제 엑셀 주문번호 join 수 |
| `payments.amountMismatchOrders` | 주문 최종금액과 결제완료 금액이 다른 주문 수 |
| `payments.methodSummary` | 결제수단별 주문/금액 |
| `payments.providerSummary` | PG provider 추정별 주문/금액 |

## 금지선

- 운영 DB write 금지
- local DB import apply 금지
- GA4/Meta/TikTok/Google Ads 전송 금지
- GTM publish 금지
- NPay intent live 배포 금지
- PII raw sample 출력 금지

## 실행 명령

```bash
cd backend

npm exec tsx scripts/coffee-imweb-operational-readonly.ts -- \
  --startSuffix=20260423 \
  --endSuffix=20260429 \
  --maxPages=8 \
  --delayMs=1200 \
  --markdown

npm exec tsx scripts/coffee-ga4-robust-guard.ts -- \
  --startSuffix=20260423 \
  --endSuffix=20260429 \
  --ids=ORDER_NO,CHANNEL_ORDER_NO \
  --markdown

npm exec tsx scripts/coffee-excel-import-dry-run.ts -- \
  --orders=../data/coffee/coffee_orders_2025.xlsx \
  --payments=../data/coffee/coffee_payments_2025.xlsx \
  --markdown
```
