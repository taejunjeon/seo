# NPay Recovery Rules

작성 시각: 2026-05-01 00:20 KST  
상태: v0 기준판  
목적: NPay recovery 매칭, 등급, 전송 차단 규칙을 한곳에 고정한다  
관련 문서: [[harness/npay-recovery/README|NPay Recovery Harness]], [[harness/npay-recovery/TASK|Task Spec]], [[harness/npay-recovery/APPROVAL_GATES|Approval Gates]], [[harness/npay-recovery/LESSONS|Lessons]]

## 10초 요약

기본값은 `read-only`, `no-send`, `send_candidate=N`이다.

전송 후보는 매우 좁게 잡는다. A급 strong, production order, manual test 아님, `already_in_ga4=robust_absent`, client/session 있음, amount reconciled, time_gap 2분 이하를 모두 만족해야 제한 테스트 승인안에 올라갈 수 있다.

## 절대 기본값

| 항목 | 기본값 |
|---|---|
| DB write | 금지 |
| GA4 MP 전송 | 금지 |
| Meta CAPI 전송 | 금지 |
| TikTok Events API 전송 | 금지 |
| Google Ads conversion 전송 | 금지 |
| GTM publish | 금지 |
| 운영 endpoint 배포 | 금지 |
| `send_candidate` | `N` |

이 기본값은 TJ님이 특정 주문/특정 전송/특정 배포를 명시 승인할 때만 바뀐다.

## Site Isolation

| site | 원칙 |
|---|---|
| `biocom` | biocom NPay recovery 기준. 운영 주문 원장과 GTM tag 118 기준 |
| `thecleancoffee` | coffee BigQuery `analytics_326949178` 기준. biocom API 권한을 coffee 주문 정본으로 쓰지 않음 |
| `aibio` | 현재는 리드/예약 원장 중심. NPay recovery rules 직접 적용 전 별도 설계 필요 |

금지:

- site filter 없이 운영 DB를 조회하고 결과를 정본처럼 쓰기.
- biocom order와 thecleancoffee order를 같은 후보 표에 섞기.
- coffee stale local mirror를 primary source로 쓰기.

## Match Status

| 상태 | 의미 | 전송 후보 |
|---|---|---|
| `strong_match` | 한 주문에 대해 가장 강한 intent 후보가 있음 | A급만 제한 후보 가능 |
| `ambiguous` | 후보가 여러 개거나 점수차가 약함 | NO |
| `purchase_without_intent` | confirmed order는 있지만 intent가 없음 | NO |
| `clicked_no_purchase` | intent는 있지만 grace window 안에 confirmed order 없음 | NO |
| `intent_pending` | 아직 구매 여부를 판단하기 이른 intent | NO |

## A급 Strong 기준

아래 조건을 모두 만족해야 한다.

| 기준 | 값 |
|---|---|
| `score` | `>= 70` |
| `amount_match_type` | `final_exact`, `shipping_reconciled`, `discount_reconciled`, `quantity_reconciled` 중 하나 |
| `time_gap_minutes` | `<= 2` |
| `score_gap` | `>= 15` |
| `order_label` | `production_order` |
| `manual_test_order` | `false` |
| `already_in_ga4` | 제한 테스트 후보는 `robust_absent` |
| `client_id` | 있음 |
| `ga_session_id` | 있음 |

주의:

A급 strong은 "바로 전송"이 아니다. "제한 테스트 승인안에 올릴 수 있는 후보"라는 뜻이다.

## B급 Strong 기준

`strong_match`이지만 A급 조건을 모두 만족하지 못하면 B급이다.

예:

- score가 50대다.
- time_gap이 길다.
- amount가 `none`이다.
- score_gap이 작다.
- client/session이 없다.

B급은 전송 금지다. B급은 원인 분석과 규칙 후보정에만 쓴다.

## Ambiguous 기준

아래 조건 중 하나라도 있으면 ambiguous로 본다.

| reason | 의미 |
|---|---|
| `multiple_intents_same_product` | 같은 상품 intent가 여러 개 |
| `same_product_multiple_clicks` | 같은 상품 버튼을 짧은 시간에 여러 번 클릭 |
| `low_score_gap` | 1등과 2등 점수차가 작음 |
| `weak_time_gap` | 결제와 클릭 시차가 커서 확정 약함 |
| `no_member_key` | 회원/전화/주문 연결키 없음 |
| `product_name_variant` | 같은 상품명이 긴 버전/짧은 버전으로 갈림 |
| `amount_not_reconciled` | 금액이 배송/할인/수량으로도 설명 안 됨 |
| `cart_multi_item_possible` | 장바구니 여러 상품 가능성 |

ambiguous는 전송 금지다.

## Amount Match Type

| type | 기준 |
|---|---|
| `final_exact` | intent price 또는 order item total이 최종 결제금액과 정확히 일치 |
| `item_exact` | intent 상품가가 주문 상품 subtotal과 일치 |
| `shipping_reconciled` | `order_payment_amount == item_total + delivery_price` 또는 `payment - intent_price == delivery_price` |
| `discount_reconciled` | `payment == item_total + delivery - discount/point` |
| `quantity_reconciled` | `payment == item_price * quantity + delivery` |
| `cart_contains_item` | 여러 상품 주문 중 intent 상품이 포함됨 |
| `none` | 설명 안 됨 |

A급 strong의 amount 조건은 `final_exact`, `shipping_reconciled`, `discount_reconciled`, `quantity_reconciled`만 허용한다.

`cart_contains_item`은 추가 검증 전에는 B급 또는 ambiguous로 둔다.

## BigQuery Guard Rules

`already_in_ga4` 판단은 보수적으로 한다.

| 상태 | 기준 | 후보 가능 |
|---|---|---|
| `present` | order_number 또는 channel_order_no 중 하나라도 GA4 raw/purchase에 있음 | NO |
| `unknown` | BigQuery 조회 미실행, 권한 없음, 날짜 범위 불충분 | NO |
| `preliminary_absent` | transaction_id 일부만 조회해 0건 | NO |
| `robust_absent` | ecommerce, event_params transaction_id, 전체 event_params value, string/int/double/float, intraday까지 확인해 0건 | 제한 테스트 후보 가능 |

필수:

1. Imweb `order_number`를 조회한다.
2. NPay `channel_order_no`를 조회한다.
3. 둘 중 하나라도 있으면 `present`다.
4. 둘 다 robust query에서 없을 때만 `robust_absent`다.

## Send Candidate Rule

`send_candidate=Y`는 approval draft에서만 의미가 있다. 실제 전송은 아니다.

`send_candidate=Y`가 되려면 아래를 모두 만족해야 한다.

```text
status == strong_match
strong_grade == A
order_label == production_order
manual_test_order == false
already_in_ga4 == robust_absent
score >= 70
amount_match_type in [final_exact, shipping_reconciled, discount_reconciled, quantity_reconciled]
time_gap_minutes <= 2
score_gap >= 15
client_id present
ga_session_id present
```

하나라도 실패하면 `send_candidate=N`이다.

## Block Reason

| 조건 | block_reason |
|---|---|
| read-only phase | `read_only_phase` |
| approval 없음 | `approval_required` |
| manual test | `manual_test_order` |
| ambiguous | `ambiguous` |
| B급 strong | `not_a_grade_strong` |
| BigQuery present | `already_in_ga4` |
| BigQuery unknown | `already_in_ga4_unknown` |
| robust guard 미실행 | `ga4_guard_missing` |
| client_id 없음 | `missing_client_id` |
| ga_session_id 없음 | `missing_ga_session_id` |
| amount mismatch | `amount_not_reconciled` |
| time gap 초과 | `time_gap_too_long` |
| score gap 부족 | `score_gap_too_low` |
| test site/order | `test_or_non_production_order` |

## Platform Order

전환 복구 플랫폼은 아래 순서를 지킨다.

1. 내부 dry-run
2. GA4 Measurement Protocol 제한 테스트
3. GA4 post-send verification
4. Meta CAPI 제한 테스트
5. TikTok Events API는 `ttclid`, `_ttp` 보강 후
6. Google Ads conversion은 마지막

Google Ads는 입찰 학습에 직접 영향을 주므로 가장 늦게 연다.

## Manual Test Order

수동 테스트 주문은 A급 strong이어도 전송 금지다.

예:

| order_number | channel_order_no | label |
|---|---|---|
| `202604309594732` | `2026043044799490` | `test_npay_manual_20260430` |

규칙:

- `send_allowed=false`
- `send_candidate=N`
- `block_reason=manual_test_order`

## 더클린커피 추가 규칙

더클린커피는 NPay recovery의 두 번째 적용 사례다.

| 규칙 | 이유 |
|---|---|
| BigQuery dataset은 `project-dadba7dd-0229-4ff6-81c.analytics_326949178`만 쓴다 | 잘못된 GA4 property 조회 방지 |
| `site=thecleancoffee`를 모든 report에 표기한다 | 사이트 간 원장 오염 방지 |
| store/site filter 없는 운영 DB 조회는 정본으로 쓰지 않는다 | 3사이트 혼합 위험 |
| local Imweb/Toss stale source는 primary 금지 | freshness 오판 방지 |
| coffee Naver Commerce API 권한 확인 전 NPay actual order 확정 금지 | biocom 권한으로 coffee 주문 조회 불가 가능 |
| coffee도 `order_number + channel_order_no` 둘 다 조회한다 | NPay 외부주문번호 차이 가능 |

## Lessons 승격

새 예외가 나오면 바로 rules에 넣지 않는다.

1. [[harness/npay-recovery/LESSONS|LESSONS]]에 observation으로 남긴다.
2. [[harness/npay-recovery/LESSONS_TO_RULES_SCHEMA|LESSONS_TO_RULES_SCHEMA]] 형식으로 candidate_rule을 만든다.
3. evidence가 쌓이면 approved_rule로 승격한다.
4. 전송 후보를 넓히는 규칙은 TJ님 승인 전 approved_rule이 될 수 없다.
