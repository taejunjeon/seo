# Coffee Data Rules

작성 시각: 2026-05-01 15:23 KST  
상태: v0 기준판  
목적: 더클린커피 GA4/Imweb/NPay/Excel 정합성 판단 규칙을 고정한다  
관련 문서: [[harness/coffee-data/README|Coffee Data Harness]], [[harness/coffee-data/CONTEXT_PACK|Coffee Context Pack]], [[harness/coffee-data/AUDITOR_CHECKLIST|Coffee Auditor Checklist]]

## 10초 요약

더클린커피는 `BigQuery-first`로 본다.

GA4에 이미 들어간 주문인지 확인할 때는 BigQuery가 primary다. NPay 실제 주문 여부는 현재 Imweb v2 API `type=npay`가 primary다. 과거 GA4 NPay형 이벤트는 주문번호가 아니라 synthetic transaction_id라서 자동 복구 전송 근거로 바로 쓰면 안 된다.

## 절대 기본값

| 항목 | 기본값 |
|---|---|
| 운영 DB write | 금지 |
| local DB actual import | 금지 |
| GA4 MP 전송 | 금지 |
| Meta CAPI 전송 | 금지 |
| TikTok Events API 전송 | 금지 |
| Google Ads conversion 전송 | 금지 |
| GTM publish | 금지 |
| 운영 endpoint 배포 | 금지 |
| `send_candidate` | `N` |

## Site Isolation

| 규칙 | 이유 |
|---|---|
| 모든 리포트에 `site=thecleancoffee`를 쓴다 | biocom/AIBIO 원장 혼합 방지 |
| BigQuery dataset은 `analytics_326949178`만 쓴다 | 잘못된 GA4 property 조회 방지 |
| store/site filter 없는 운영 DB 결과를 primary로 쓰지 않는다 | 3사이트 데이터 혼합 위험 |
| biocom Naver API 권한을 coffee 주문 정본처럼 쓰지 않는다 | 판매자/API scope가 다를 수 있음 |

## Source Priority

| 질문 | 1순위 | 2순위 | 3순위 |
|---|---|---|---|
| GA4 event 존재 | BigQuery raw export | GA4 UI | 없음 |
| NPay actual order | Imweb v2 API `type=npay` | Naver Commerce API 권한 확보 후 | PlayAuto/Excel |
| Toss/card order | `tb_sales_toss store=coffee` | Imweb v2 API | Excel |
| 과거 고객/주문 보강 | 2024/2025 Excel dry-run | Imweb v2 API | local mirror |
| ROAS | 광고 API fresh token + GA4/order same window | CSV export | 문서 숫자 |

## NPay Matching Classification

| 상태 | 의미 | 전송 후보 |
|---|---|---|
| `A_strong` | 금액/시간/상품 근거가 강한 1:1 배정 | 현재는 NO |
| `B_strong` | strong이지만 A 기준 일부 부족 | NO |
| `probable` | 후보 가능성은 있으나 자동 판단 불충분 | NO |
| `ambiguous` | 후보가 여러 개거나 점수차가 약함 | NO |
| `purchase_without_ga4` | 실제 주문은 있으나 GA4 근거 없음 | NO |
| `ga4_without_order` | GA4 이벤트는 있으나 실제 주문 근거 없음 | NO |

현재 coffee Phase2에서는 모든 row가 `send_candidate=N`이다.

## One-to-one Assignment Rule

목표는 같은 GA4 event를 여러 주문에 중복 배정하지 않는 것이다.

규칙:

1. 후보 edge를 score 높은 순으로 정렬한다.
2. 이미 주문에 배정된 GA4 transaction은 다른 주문에 다시 배정하지 않는다.
3. 이미 GA4 transaction을 받은 주문은 다른 GA4 event를 다시 받지 않는다.
4. score가 낮으면 unassigned로 남긴다.
5. unassigned는 자동 전송 후보가 아니라 원인 분석 대상이다.

## Amount Match Type

| type | 기준 | 판단 |
|---|---|---|
| `final_exact` | 주문 최종 결제금액과 GA4 revenue가 일치 | 강함 |
| `shipping_reconciled` | 상품가 + 배송비 = 결제금액 | 강함, 단 승인안에서 배송비 근거 확인 |
| `discount_reconciled` | 상품가 + 배송비 - 할인 = 결제금액 | 강함 |
| `quantity_reconciled` | 단가 * 수량 + 배송비 = 결제금액 | 강함 |
| `near_exact` | 소액 차이 또는 반올림 가능성 | 보조 |
| `cart_contains_item` | 장바구니 일부 상품만 맞음 | 보조, 자동 후보 금지 |
| `none` | 설명 안 됨 | 약함 |

`shipping_reconciled`는 classification에는 쓴다. 실제 전송 후보를 넓히는 근거로 사용할 때는 별도 승인안이 필요하다.

## BigQuery Guard

| 상태 | 기준 | 의미 |
|---|---|---|
| `present` | `order_number` 또는 `channel_order_no` 중 하나가 GA4 raw에 있음 | 이미 수신 가능성 있음 |
| `robust_absent` | ecommerce transaction, event_params transaction, 전체 event_params value에서 모두 0건 | GA4 raw에 직접 없음 |
| `unknown` | 조회 안 함, 권한 없음, window 부족 | 판단 불가 |

필수 조회 대상:

1. Imweb `order_no`
2. NPay `channel_order_no`

둘 중 하나라도 있으면 `present`다. 둘 다 robust search에서 없을 때만 `robust_absent`다.

## Excel Rule

| 규칙 | 이유 |
|---|---|
| Excel actual import는 승인 전 금지 | local 원장 오염 방지 |
| 2024/2025 주문/결제 join은 dry-run으로만 본다 | join 품질 확인 |
| 2023 파일은 header-only로 표시한다 | 데이터 없는 파일을 정본으로 오해하지 않기 |
| phone/email 원문 사용은 최소화한다 | 개인정보 보호 |
| 분석 산출물에는 집계값과 마스킹만 남긴다 | 공유 문서 안전성 |

## ROAS Rule

ROAS 비교는 아래 조건을 모두 만족해야 시작한다.

1. 광고비 source token freshness 확인.
2. 주문 window와 광고 window KST 기준 일치.
3. GA4 purchase와 actual order 차이 명시.
4. NPay/Toss/기타 결제수단 분리.
5. 전송 복구는 포함하지 않음.

## Block Reason

| 조건 | block_reason |
|---|---|
| read-only phase | `read_only_phase` |
| ambiguous | `ambiguous` |
| B급/probable | `not_a_grade_strong` |
| BigQuery present | `already_in_ga4` |
| BigQuery unknown | `already_in_ga4_unknown` |
| robust guard 미실행 | `ga4_guard_missing` |
| Naver API 권한 불명확 | `naver_api_scope_unknown` |
| stale source primary 사용 | `stale_source_primary` |
| Excel actual import 미승인 | `excel_apply_not_approved` |

## 현재 적용 판단

2026-05-01 14:43 KST 기준:

1. Imweb NPay actual 60건과 GA4 NPay형 58건은 1:1 exact 구조가 아니다.
2. one-to-one assigned 42건은 분석 가능하지만 전송 후보가 아니다.
3. unassigned actual 18건의 order/channel 36개는 robust_absent다.
4. 이 결과는 과거분 자동 복구 전송 승인 근거가 아니라, future intent 장부 필요성을 강화하는 근거다.
