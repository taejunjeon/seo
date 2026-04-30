# 더클린커피 아임웹/운영 DB Read-only 주문 원장 대조

작성 시각: 2026-05-01 02:03 KST
site: `thecleancoffee`
phase: `read_only`
분석 window: 2026-04-23 00:00 KST ~ 2026-04-29 23:59 KST
Primary source: Imweb v2 API `IMWEB_API_KEY_COFFEE`, GA4 BigQuery `project-dadba7dd-0229-4ff6-81c.analytics_326949178`
Cross-check: 운영 Postgres `public.tb_sales_toss store=coffee`, `public.tb_playauto_orders shop_name='아임웹-C'`, local SQLite `imweb_orders` freshness check
Freshness: Imweb v2 API 2026-05-01 02:02 KST read-only 실행, GA4 `events_20260423`~`events_20260429`, 운영 DB read-only 조회
Confidence: 89%

## 10초 요약

더클린커피는 네이버 API를 기다리지 않고도 **아임웹 API를 실제 주문 원장 primary로 사용해 NPay actual order를 확인할 수 있다**.

2026-04-23~2026-04-29 window에서 Imweb v2 API는 전체 주문 113건, 4,699,767원을 반환했고, 이 중 NPay actual order는 60건, 2,462,300원이다. 같은 window GA4 BigQuery purchase는 108건, 4,454,524원이고, GA4 NPay형 transaction은 58건, 2,359,300원이다.

즉, 더클린커피 NPay는 `실제 아임웹 주문 원장`과 `GA4 NPay형 purchase` 사이에 **2건 / 103,000원 차이**가 보인다. 다만 GA4 NPay transaction_id가 `NPAY - 202603123 - timestamp` 형태라 Imweb `order_no`나 NPay `channel_order_no`와 직접 같지 않다. 그래서 과거분은 시간/금액/상품명으로 보수적으로 매칭해야 하고, 자동 복구 전송은 아직 금지다.

## Auditor Verdict

```text
Auditor verdict: PASS_WITH_NOTES
Phase: coffee_imweb_operational_read_only
No-send verified: YES
No-write verified: YES
No-deploy verified: YES
Candidate guard verified: N/A
Numbers current: YES
Unrelated dirty files excluded: YES
No-send grep matched docs/code only: YES
New executable send path added: NO
Actual network send observed: NO
Notes:
- Imweb v2 API, GA4 BigQuery, 운영 Postgres 모두 read-only 조회만 수행했다.
- 운영 DB write, Imweb write, GTM publish, GA4/Meta/TikTok/Google Ads 전송은 0건이다.
- 새 스크립트는 read-only report 생성용이며 dispatcher나 endpoint가 아니다.
```

## 실행 명령

```bash
cd backend
npm exec tsx scripts/coffee-imweb-operational-readonly.ts -- \
  --startSuffix=20260423 \
  --endSuffix=20260429 \
  --maxPages=8 \
  --delayMs=1200 \
  --json
```

## Source 결과

| source | 결과 | 판단 |
|---|---:|---|
| Imweb v2 API 전체 주문 totalCount | 2,093 | coffee 주문 API 접근 가능 |
| Imweb v2 API NPay 주문 totalCount | 922 | `type=npay` 필터 작동 |
| Imweb API scan stop reason | `window_covered` | 최근 7일 window 확보 |
| Imweb API errors | 0 | rate limit 재시도 없이 성공 |
| local SQLite `imweb_orders` latest | 2026-04-04 10:38 KST | stale, primary 금지 |
| 운영 `tb_iamweb_users` coffee order_no match | 0건 | coffee primary로 쓰면 안 됨 |
| 운영 `tb_sales_toss store=coffee` | 52 rows matched | Toss/card cross-check 가능 |
| 운영 `tb_playauto_orders shop_name='아임웹-C'` | 105 orders matched | 상품명/배송상태 cross-check 가능 |

## 주문/매출 요약

| 지표 | 건수 | 금액 |
|---|---:|---:|
| Imweb API 전체 주문 | 113 | 4,699,767 |
| Imweb API NPay actual order | 60 | 2,462,300 |
| Imweb API card | 49 | 2,112,582 |
| Imweb API virtual | 4 | 124,885 |
| GA4 purchase | 108 | 4,454,524 |
| GA4 NPay형 purchase | 58 | 2,359,300 |
| GA4 non-NPay purchase | 50 | 2,095,224 |
| GA4 exact Imweb order_no match | 50 | non-NPay 중심 |

해석:

1. non-NPay는 GA4 transaction_id가 Imweb `order_no`와 직접 맞는다.
2. NPay는 GA4 transaction_id가 Imweb `order_no`/`channel_order_no`가 아니므로 직접 exact match가 안 된다.
3. NPay actual 기준으로 보면 GA4 NPay형 purchase가 2건/103,000원 낮다.
4. 이 차이는 GA4 누락일 수도 있고, GA4 NPay형 이벤트 중복/오탐 보정 결과일 수도 있으므로 주문별 dry-run이 필요하다.

## NPay Actual ↔ GA4 NPay형 매칭 초안

스코어 기준:

| 구성요소 | 점수 |
|---|---:|
| 금액 exact | +45 |
| 배송비 제외로 설명 가능 | +38 |
| 상품금액 exact | +34 |
| 금액 1,000원 이내 | +30 |
| 금액 3,000원 이내 | +16 |
| 시간차 2분 이내 | +35 |
| 시간차 10분 이내 | +25 |
| 시간차 60분 이내 | +10 |
| PlayAuto 상품명과 GA4 item_name overlap | +10~20 |

초기 결과:

| 분류 | 건수 | 해석 |
|---|---:|---|
| strong_match | 29 | 자동 후보처럼 보이나 아직 전송 금지 |
| probable_match | 2 | 수동 검토 후보 |
| ambiguous | 29 | 같은 금액/비슷한 상품 반복으로 자동 확정 위험 |
| actual_without_ga4_candidate | 0 | 후보가 전혀 없는 actual order는 없음 |
| ga4_without_actual_candidate | 28 | unique one-to-one matching이 아직 약함 |

금액 보정 요약:

| amount_match_type | 건수 | 해석 |
|---|---:|---|
| `shipping_reconciled` | 29 | GA4 revenue가 배송비를 제외한 금액으로 보임 |
| `final_exact` | 27 | GA4 revenue와 최종 결제금액 일치 |
| `near_exact` | 2 | 1,000원 이내 |
| `none` | 2 | 금액 보정 불가 |

ambiguous reason 요약:

| reason | 건수 | 해석 |
|---|---:|---|
| `low_score_gap` | 29 | 1등/2등 후보 차이가 작음 |
| `multiple_ga4_candidates` | 29 | 같은 actual order에 GA4 후보가 여러 개 붙음 |
| `same_amount_many_orders` | 24 | 동일 결제금액 주문 반복 |
| `weak_time_gap` | 20 | 결제시각과 GA4 event 시각 차이가 큼 |
| `no_product_evidence` | 3 | PlayAuto 상품 증거 없음 |
| `product_name_variant_or_no_overlap` | 3 | 상품명 overlap 약함 |
| `amount_not_reconciled` | 2 | 금액이 배송비/할인/근사값으로 설명되지 않음 |

주의:

이 매칭은 아직 운영 전송용이 아니다. 더클린커피는 주문 건수가 작고 동일 금액/동일 상품 반복이 많아 시간+금액만으로는 ambiguous가 크게 나온다. Biocom처럼 버튼 intent 장부가 없으면 과거 NPay purchase를 주문 단위로 자동 복구하는 신뢰도가 낮다.

## Primary / Cross-check 재정의

| 질문 | Primary | Cross-check | 쓰면 안 되는 것 |
|---|---|---|---|
| 더클린커피 실제 Imweb 주문인가 | Imweb v2 API | PlayAuto `아임웹-C`, Toss `store=coffee` | `tb_iamweb_users` unscoped |
| NPay actual order인가 | Imweb v2 API `type=npay` | `channel_order_no` 존재, PlayAuto 상품 라인 | GA4 `NPAY - ...` transaction만으로 확정 |
| 상품명/옵션은 무엇인가 | PlayAuto `shop_sale_name`, `shop_opt_name` | GA4 items | Imweb v2 order header 단독 |
| GA4에 이미 purchase가 있는가 | BigQuery raw export | robust search query | GA4 UI만 |
| 과거 LTV/고객 원장 | 2025/2024 아임웹 엑셀 | local SQLite backfill 후 검증 | stale local SQLite 단독 |

## 네이버 API 대기 없이 가능한 다음 작업

| 순서 | 담당 | 작업 | 왜 | 어떻게 |
|---:|---|---|---|---|
| 1 | Codex | Imweb API 기반 daily order ledger report 고정 | coffee NPay actual order는 이미 Imweb API로 확인 가능 | `coffee-imweb-operational-readonly.ts`를 날짜별 summary와 mismatch report로 확장 |
| 2 | Codex | NPay actual vs GA4 NPay형 mismatch 2건/103,000원 최종 원인 확정 | 누락인지 오탐인지 판단 | strong/probable 제외 후 ambiguous 29건을 주문별 paid_at, amount, PlayAuto product, GA4 item/time 후보로 재검토 |
| 3 | Codex | ambiguous 29건 축소 | 자동 전송 위험을 줄임 | 동일 금액 반복, 상품명 변형, cart multi-item, 시간차, GA4 중복 후보로 라벨링 |
| 4 | Codex | coffee용 dry-run schema 고정 | 매번 수동 해석하지 않게 함 | `order_no`, `channel_order_no`, `ga4_transaction_id`, `match_grade`, `block_reason` |
| 5 | TJ | 네이버 주문형 API 권한 확인 | 정산/공식 원장 cross-check용 | 네이버 기술지원 답변 수신 후 optional source로 추가 |
| 6 | Codex | coffee NPay intent beacon 설계안 작성 | 미래 데이터는 주문 매칭 신뢰도를 높여야 함 | GTM preview 전용 초안, live publish는 별도 승인 |

## 현재 추천

추천안: **네이버 API를 기다리지 말고 Imweb API primary로 더클린커피 read-only 정합성을 계속 진행한다.**

자신감: 89%

이유:

1. Imweb API가 coffee 주문과 `type=npay` 필터를 정상 반환한다.
2. 실제 NPay 주문번호인 `channel_order_no`가 60/60건 채워져 있다.
3. non-NPay는 GA4 transaction_id와 Imweb `order_no`가 50건 exact match라 API 원장 신뢰도가 높다.
4. 운영 `tb_iamweb_users`는 coffee order_no가 0건 매칭되므로 coffee에는 primary가 아니다.
5. PlayAuto는 상품/상태 cross-check로 유용하지만 금액은 0으로 들어와 결제 원장 primary는 아니다.

## 금지 유지

- 운영 DB write 금지
- Imweb API write 금지
- Excel actual import apply 금지
- coffee GTM publish 금지
- coffee NPay intent live 배포 금지
- GA4/Meta/TikTok/Google Ads 전송 금지
- 운영 endpoint 배포 금지

## Eval Log

```yaml
run_id: "coffee-imweb-operational-readonly-20260501-0202"
created_at_kst: "2026-05-01 02:03 KST"
created_by: "Codex"
phase: "read_only"
site: "thecleancoffee"
mode: "read_only"
window_kst:
  start: "2026-04-23 00:00 KST"
  end: "2026-04-29 23:59 KST"
sources:
  primary:
    - name: "Imweb v2 API /v2/shop/orders"
      freshness_at_kst: "2026-05-01 02:02 KST"
      confidence: 0.89
    - name: "GA4 BigQuery analytics_326949178"
      freshness_at_kst: "events_20260429"
      confidence: 0.92
  cross_checks:
    - name: "operational_postgres.public.tb_sales_toss store=coffee"
      confidence: 0.82
    - name: "operational_postgres.public.tb_playauto_orders shop_name='아임웹-C'"
      confidence: 0.78
summary:
  imweb_api_orders: 113
  imweb_api_revenue: 4699767
  imweb_api_npay_orders: 60
  imweb_api_npay_revenue: 2462300
  ga4_purchase_events: 108
  ga4_revenue: 4454524
  ga4_npay_pattern_events: 58
  ga4_npay_pattern_revenue: 2359300
  ga4_exact_imweb_matches: 50
  npay_actual_strong_match: 29
  npay_actual_probable_match: 2
  npay_actual_ambiguous: 29
  npay_actual_ambiguous_reason_summary:
    low_score_gap: 29
    multiple_ga4_candidates: 29
    same_amount_many_orders: 24
    weak_time_gap: 20
    no_product_evidence: 3
    product_name_variant_or_no_overlap: 3
    amount_not_reconciled: 2
  npay_actual_best_amount_match_type_summary:
    shipping_reconciled: 29
    final_exact: 27
    near_exact: 2
    none: 2
  tb_iamweb_users_matched_orders: 0
guardrails:
  no_send_verified: true
  no_db_write_verified: true
  no_deploy_verified: true
confidence: 0.89
```
