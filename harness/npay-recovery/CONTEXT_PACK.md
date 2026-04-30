# NPay Recovery Context Pack

작성 시각: 2026-05-01 00:20 KST  
상태: v0 기준판  
목적: NPay recovery 작업 전에 반드시 읽어야 할 문서, 데이터 소스, 최신 숫자를 한곳에 모은다  
관련 문서: [[harness/npay-recovery/README|NPay Recovery Harness]], [[harness/npay-recovery/TASK|Task Spec]], [[harness/npay-recovery/RULES|Rules]]

## 10초 요약

이 파일은 agent가 작업 전에 조립해야 하는 context 목록이다.

핵심은 세 가지다. 첫째, NPay 작업은 기본값이 read-only/no-send다. 둘째, 주문번호는 Imweb `order_number`와 NPay `channel_order_no`를 둘 다 본다. 셋째, 숫자는 항상 source, window, freshness, confidence와 함께 기록한다.

## 필수로 읽을 문서

| 순서 | 문서 | 왜 읽는가 |
|---:|---|---|
| 1 | [[harness/npay-recovery/README|README]] | 하네스 목적과 phase map 확인 |
| 2 | [[harness/npay-recovery/TASK|TASK]] | 이번 작업 phase와 허용 범위 확정 |
| 3 | [[harness/npay-recovery/RULES|RULES]] | A급/B급/ambiguous/차단 기준 확인 |
| 4 | [[harness/npay-recovery/APPROVAL_GATES|APPROVAL_GATES]] | TJ님 승인 전 금지 작업 확인 |
| 5 | [[naver/!npayroas|NPay ROAS 정합성 회복 계획]] | 최신 운영 숫자와 현재 판단 확인 |
| 6 | [[naver/npay-roas-dry-run-20260430|NPay dry-run report]] | dry-run 상세 후보 확인 |
| 7 | [[naver/npay-ga4-mp-limited-test-approval|GA4 MP 제한 테스트 승인안]] | 제한 전송 승인 구조 확인 |
| 8 | [[naver/npay-ga4-mp-limited-test-result-20260430|GA4 MP 제한 테스트 결과]] | 이미 보낸 주문과 중복 방지 확인 |
| 9 | [[harness/npay-recovery/AUDITOR_CHECKLIST|AUDITOR_CHECKLIST]] | 종료 전 fail/pass 판단 |
| 10 | [[harness/npay-recovery/LESSONS_TO_RULES_SCHEMA|LESSONS_TO_RULES_SCHEMA]] | 새 예외 기록 형식 |

## 현재 기준 숫자

기준 문서: [[naver/!npayroas|NPay ROAS 정합성 회복 계획]]  
기준 시각: 2026-04-30 21:30 KST  
site: `biocom`  
confidence: 90%

| 지표 | 값 |
|---|---:|
| live intent | 304건 |
| confirmed NPay 주문 | 11건 |
| strong match | 8건 |
| A급 strong | 6건 |
| A급 production 후보 | 5건 |
| GA4 MP 제한 테스트 전송 | 1건 |
| 남은 dispatcher dry-run 후보 | 4건 |
| B급 strong | 2건 |
| ambiguous | 3건 |
| purchase_without_intent | 0건 |
| clicked_no_purchase | 209건 |
| intent_pending | 87건 |
| Meta/TikTok/Google Ads 전송 | 0건 |

주의:

이 숫자는 report 기준 시각 이후 바뀔 수 있다. 새 작업에서 dry-run을 다시 실행하면 이 표와 다를 수 있다. 다르면 문서를 갱신하거나 `stale_by_design` 이유를 기록한다.

## 핵심 데이터 소스

| Source | 위치 | 역할 | 쓰기 가능 여부 |
|---|---|---|---|
| NPay intent | VM SQLite `npay_intent_log` | 버튼 클릭 intent 원장 | NO, read-only 기본 |
| 운영 주문 원장 | `operational_postgres.public.tb_iamweb_users` | confirmed NPay 주문 정본 후보 | NO, read-only 기본 |
| GA4 BigQuery | biocom은 TJ robust query 결과, coffee는 `analytics_326949178` | 이미 GA4에 들어간 주문 guard | NO, read-only |
| GTM | biocom `GTM-W2Z6PHN`, tag 118 | NPay intent 수집 스크립트 | publish는 승인 필요 |
| local SQLite | `backend/data/crm.sqlite3` | 개발/보조 snapshot | write도 승인/백업 필요 |
| 문서 | `naver/*.md`, `harness/*.md` | 의사결정 기록 | 수정 가능 |

## 데이터 해석 원칙

데이터 정합성 작업은 하나의 source를 단일 정답으로 보지 않는다.

| 질문 | Primary | Cross-check | Fallback |
|---|---|---|---|
| 버튼을 눌렀는가 | VM SQLite `npay_intent_log` | protected API | GTM/Network evidence |
| 실제 NPay 결제가 있었는가 | 운영 주문 원장 | Naver/Imweb order detail | 금액/시간/상품 weak match |
| GA4에 이미 들어갔는가 | BigQuery robust query | GA4 raw export | Data API, Realtime |
| 전송 후보인가 | dry-run rules | Auditor checklist | human review |
| 광고 전송해도 되는가 | TJ approval | Approval document | none |

## 필수 키

| 키 | 왜 필요한가 |
|---|---|
| `order_number` | Imweb/운영 주문번호. GA4 transaction_id로 쓰기 좋은 기준 |
| `channel_order_no` | NPay 외부 주문번호. Imweb order_number와 다를 수 있음 |
| `client_id` | GA4 Measurement Protocol client_id |
| `ga_session_id` | session attribution 가능성 판단 |
| `ga_session_number` | 세션 보조 정보 |
| `product_idx` | intent와 주문 상품 매칭 |
| `product_name` | 상품명 변형/장바구니 판단 |
| `order_payment_amount` | 최종 결제금액 |
| `item_total` | 상품 합계 |
| `delivery_price` | 배송비 reconciliation |
| `discount_amount` | 할인/포인트 reconciliation |
| `already_in_ga4` | 중복 전송 방지 |
| `order_label` | production/manual_test 구분 |

## BigQuery Guard 상태

| 상태 | 의미 | 전송 후보 가능 |
|---|---|---|
| `present` | GA4 raw/purchase에 이미 ID가 있음 | NO |
| `unknown` | 확인하지 못했거나 query 범위가 부족함 | NO |
| `preliminary_absent` | 일부 쿼리에서만 0건 | NO |
| `robust_absent` | ecommerce, event_params, 전체 value, intraday까지 확인해 0건 | 제한 테스트 후보의 필요조건 |

## 더클린커피 Context

관련 문서: [[data/!coffeedata|더클린커피 데이터 정합성 프로젝트 검토]]

| 항목 | 값 |
|---|---|
| site | `thecleancoffee` |
| GA4 property | `326949178` |
| Measurement ID | `G-JLSBXX7300` |
| BigQuery project | `project-dadba7dd-0229-4ff6-81c` |
| BigQuery dataset | `analytics_326949178` |
| location | `asia-northeast3` |
| 최신 freshness | 2026-04-30 23:52 KST 기준 `events_20260429`, rows 2,228, purchase 21 |
| 현재 1차 목표 | GA4 BigQuery와 실제 주문/결제 원장 read-only 대조 |

더클린커피 작업 추가 주의:

1. `site=thecleancoffee`를 모든 report에 명시한다.
2. coffee BigQuery dataset이 `analytics_326949178`인지 확인한다.
3. biocom Naver Commerce API 권한을 coffee 주문 정본으로 쓰지 않는다.
4. local Imweb/Toss stale snapshot은 정본으로 쓰지 않는다.
5. coffee NPay actual order는 Naver seller/API 권한 확인 전까지 blocker로 둔다.

## Source Freshness 필수 기록

모든 숫자에는 아래를 붙인다.

```yaml
source: "어떤 DB/API/문서인가"
site: "biocom | thecleancoffee | aibio"
window_kst:
  start: "YYYY-MM-DD HH:mm KST"
  end: "YYYY-MM-DD HH:mm KST"
freshness_at_kst: "YYYY-MM-DD HH:mm KST"
checked_at_kst: "YYYY-MM-DD HH:mm KST"
confidence: 0.0
```

## Context Assembly Checklist

작업 시작 전 agent는 아래를 확인한다.

1. site가 명확한가.
2. window가 명확한가.
3. 이번 phase가 read-only인지, approval draft인지, limited send인지 명확한가.
4. BigQuery guard 상태가 최신인가.
5. `order_number`와 `channel_order_no`를 둘 다 볼 준비가 되어 있는가.
6. stale source를 primary로 쓰지 않았는가.
7. 전송/DB write/배포가 금지인지 허용인지 명확한가.
8. 종료 전 auditor checklist를 적용할 계획이 있는가.
