# 더클린커피 데이터 정합성 프로젝트 검토

작성 시각: 2026-04-30 23:51 KST  
최신 read-only 확인: 2026-04-30 23:52 KST  
문서 성격: 검토안 + 실행 설계안  
대상 사이트: `thecleancoffee.com`, 더클린커피 아임웹/GA4/BigQuery/NPay/ROAS  
관련 문서: [[!datacheckplan]], [[!bigquery]], [[iamweb_excel_backfill_review]], [[toss_sync_gap]], [[roasphase]], [[naver/!npayroas|biocom NPay ROAS 정합성 계획]]
Primary source: GA4 BigQuery `project-dadba7dd-0229-4ff6-81c.analytics_326949178`, 운영 Postgres `tb_sales_toss`, `tb_playauto_orders`, 더클린커피 아임웹 엑셀  
Cross-check: local SQLite `imweb_orders`, `toss_transactions`, existing reconciliation scripts, Naver Commerce API scope check  
Freshness: `check-source-freshness.ts --json`, 2026-04-30 23:52 KST 실행  
Confidence: 86%

## 다음 할일

| 순서 | 담당 | 할 일 | 왜 하는가 | 어떻게 하는가 | 컨펌 필요 |
|---:|---|---|---|---|---|
| 1 | Codex | 더클린커피 GA4 BigQuery 기준선을 최신 7일로 뽑는다 | coffee는 BigQuery 접근 가능하므로 GA4 purchase/raw event를 정본 guard로 쓸 수 있는지 먼저 확인해야 한다 | `analytics_326949178.events_*`에서 purchase, transaction_id, payment method, item_name, page_location, source/medium을 조회한다 | NO, read-only |
| 2 | Codex | GA4 purchase transaction_id와 운영 주문 원장 후보를 read-only로 대조한다 | GA4가 실제 주문을 얼마나 반영하는지 알아야 NPay/ROAS 복구 필요성을 판단할 수 있다 | 운영 Postgres `tb_sales_toss`, `tb_playauto_orders`, 가능하면 `tb_iamweb_users`의 더클린커피 row를 기간/금액/주문번호로 조인한다 | NO, read-only |
| 3 | Codex | coffee용 NPay dry-run 리포트 스펙을 만든다 | biocom에서 만든 `intent -> confirmed order -> BigQuery guard` 구조를 커피에도 재사용할 수 있다 | `order_number`, `channel_order_no`, `amount_match_type`, `already_in_ga4`, `match_grade` 컬럼을 포함한 markdown/JSON 리포트 초안을 만든다 | NO, 문서/코드 초안 |
| 4 | TJ | 더클린커피 네이버 판매자/API 권한 여부를 확인한다 | 현재 biocom 스코프 Naver Commerce API로 coffee NPay 주문을 조회하면 권한이 막힐 가능성이 높다 | 네이버 커머스/판매자센터에서 더클린커피 스토어 앱 권한 또는 API 인증 정보를 확인한다 | YES, 외부 계정 작업 |
| 5 | Codex | 2025 더클린커피 엑셀을 정합성 원장으로 쓰는 import dry-run을 설계한다 | 커피는 PG/Toss보다 엑셀의 비마스킹 phone/이메일/배송/결제수단 정보 가치가 크다 | 기존 `data/coffee/기본_양식_20260424133106.xlsx` 기준 schema, 중복키, 금액 reconciliation 규칙을 문서화한다 | NO, dry-run까지 |
| 6 | TJ | 2025 결제내역 엑셀과 2024 주문/결제 엑셀 다운로드를 준비한다 | 2025 주문 엑셀만으로는 결제수단/환불/정산 검증이 부족하고, 2024 이전 LTV는 phone 마스킹 문제가 있다 | 아임웹 관리자에서 더클린커피 결제내역/주문내역을 연도별로 다운로드한다 | YES |
| 7 | Codex | Meta/TikTok ROAS 정합성은 source freshness가 닫힌 뒤 재개한다 | 커피 Meta 토큰/운영 원장 freshness가 불안정하면 ROAS 비교가 오판된다 | token, BigQuery, 주문 원장, Toss/Excel freshness를 같은 window로 맞춘 뒤 비교한다 | 부분 YES, token 갱신 필요 가능 |

## 10초 요약

결론은 **YES: 더클린커피 데이터 정합성 프로젝트를 바로 시작할 가치가 있다**.

이유는 세 가지다.

1. 더클린커피는 biocom과 달리 GA4 BigQuery raw export에 현재 접근 가능하다. 2026-04-30 23:52 KST 기준 `events_20260429`가 fresh이고, rows `2,228`, purchase `21`, distinct transaction `21`로 확인됐다.
2. 아임웹 구조가 유사하므로 biocom NPay ROAS에서 만든 `order_number + channel_order_no`, `already_in_ga4 guard`, `amount_match_type`, `A급/B급/ambiguous` 규칙을 재사용할 수 있다.
3. 더클린커피는 2025년 아임웹 엑셀에 비마스킹 phone/이메일/배송/결제 정보가 있어, LTV와 주문 정합성 분석의 기준 데이터로 쓰기 좋다.

다만 바로 광고 전환 복구를 열면 안 된다. 커피 NPay 실제 주문 원장은 Naver Commerce API 권한이 아직 불확실하고, local Imweb/Toss 미러는 stale이다. 따라서 1차 목표는 **GA4 BigQuery를 기준 guard로 삼아 실제 주문 원장과 맞는지 read-only로 검증하는 것**이다.

## 현재 결론

| 질문 | 결론 | 자신감 | 이유 |
|---|---|---:|---|
| 더클린커피를 데이터 정합성 프로젝트로 착수할까 | YES | 86% | BigQuery 접근 가능, GA4 연결됨, 아임웹 구조 유사, 2025 엑셀 원장 있음 |
| biocom NPay 방식이 그대로 먹히나 | 부분 YES | 74% | 아임웹 주문 구조는 유사하지만 coffee NPay 실제 주문 API 권한은 별도 확인 필요 |
| BigQuery를 `already_in_ga4` guard로 쓸 수 있나 | YES | 92% | `analytics_326949178` daily export가 fresh이고 purchase transaction_id가 잡힘 |
| 지금 GA4/Meta/TikTok purchase 복구를 열까 | NO | 95% | 실제 주문 매칭과 NPay 원장 권한 확인 전에는 전송 금지 |
| 더클린커피가 biocom 문제 해결에 힌트를 줄 수 있나 | YES | 88% | 같은 GA4 export schema, 같은 아임웹/NPay 계열이면 BigQuery 쿼리와 매칭 규칙을 먼저 검증 가능 |

## Phase-Sprint 요약표

| Phase | Sprint | 이름 | 담당 | 상태(우리/운영) | 상세 |
|---|---|---|---|---|---|
| Phase0 | [[#Phase0-Sprint1]] | 프로젝트 판단과 안전선 | Codex | 100% / 0% | [[#Phase0-Sprint1]] |
| Phase1 | [[#Phase1-Sprint2]] | Source freshness 기준선 | Codex | 70% / 0% | [[#Phase1-Sprint2]] |
| Phase1 | [[#Phase1-Sprint3]] | 2025 엑셀 원장화 검토 | Codex + TJ | 75% / 0% | [[#Phase1-Sprint3]] |
| Phase2 | [[#Phase2-Sprint4]] | GA4 BigQuery와 주문 원장 대조 | Codex | 35% / 0% | [[#Phase2-Sprint4]] |
| Phase2 | [[#Phase2-Sprint5]] | Coffee NPay 실제 주문 매칭 | Codex + TJ | 25% / 0% | [[#Phase2-Sprint5]] |
| Phase3 | [[#Phase3-Sprint6]] | Coffee NPay intent 장부 | Codex | 20% / 0% | [[#Phase3-Sprint6]] |
| Phase3 | [[#Phase3-Sprint7]] | Meta/TikTok/ROAS 정합성 | Codex + TJ | 20% / 0% | [[#Phase3-Sprint7]] |
| Phase4 | [[#Phase4-Sprint8]] | 공통 Growth Data Harness 편입 | Codex + Claude | 25% / 0% | [[#Phase4-Sprint8]] |

상태 해석:

- `우리`: 문서, 코드 초안, read-only 분석 준비도.
- `운영`: 실제 운영 반영, 정기 실행, 대시보드/알림 적용도.
- 이 문서는 운영 변경이 아니라 검토/설계 문서이므로 운영 상태는 의도적으로 0%에서 시작한다.

## 지금 확인된 데이터 소스

### Read-only freshness 결과

실행 명령:

```bash
cd backend
npm exec tsx scripts/check-source-freshness.ts -- --json
```

실행 시각: 2026-04-30 23:52 KST

| Source | 상태 | 최신 기준 | 값 | 판단 |
|---|---|---|---|---|
| `ga4_bigquery_thecleancoffee` | fresh | `events_20260429`, latest event `2026-04-29 23:57:37 KST` | rows `2,228`, purchase `21`, distinct transaction `21` | 바로 분석 가능 |
| `ga4_bigquery_biocom` | error | `hurdlers-naver-pay.analytics_304759974` | `bigquery.datasets.get denied` | coffee가 비교군으로 유리 |
| `toss_operational` | watch | `tb_sales_toss`, synced `2026-04-29 21:00:30 KST` | rows `9,356`, latest approved `2026-04-30 03:27:08 KST` | read-only 대조 가능 |
| `playauto_operational` | watch | `tb_playauto_orders`, synced `2026-04-29 20:00:08 KST` | rows `122,639`, latest pay `2026-04-29 17:14:11 KST` | read-only 대조 가능 |
| `imweb_local_orders` | stale | local SQLite | latest order/complete around `2026-04-15` | 정본으로 쓰면 안 됨 |
| `toss_local_transactions` | stale | local SQLite | synced `2026-04-24`, event max `2026-04-23` | 보조로만 사용 |
| `attribution_ledger` | data_sparse | local SQLite | latest `2026-04-12` | 커피 live 판단에는 부적합 |

### GA4 BigQuery

| 항목 | 값 |
|---|---|
| Project | `project-dadba7dd-0229-4ff6-81c` |
| Dataset | `analytics_326949178` |
| Location | `asia-northeast3` |
| GA4 property | `326949178` |
| Measurement ID | `G-JLSBXX7300` |
| 최근 확인 | `events_20260429`, purchase `21`, distinct transaction `21` |
| 판단 | coffee는 GA4 raw event 기준 guard를 지금 쓸 수 있음 |

### 아임웹/엑셀

`data/iamweb_excel_backfill_review.md` 기준 더클린커피 2025 주문 엑셀은 아래 가치를 가진다.

| 항목 | 값 |
|---|---:|
| 파일 | `data/coffee/기본_양식_20260424133106.xlsx` |
| 행 | 16,454행 |
| 고유 주문번호 | 11,018건 |
| 고유 정규화 전화번호 | 4,089명 |
| 기간 | 2025-01-01 08:12 ~ 2025-12-31 22:32 |
| 거래종료 주문 | 7,613건 |
| 거래종료 매출 | 279,093,357원 |
| 장점 | phone/이메일/배송지/취소사유/금액 분해가 PG보다 좋음 |

해석: 커피는 2025 과거 백필과 LTV 분석에서 API보다 엑셀이 더 강하다. 운영 incremental은 API/DB, 과거 정합성은 엑셀을 primary로 두는 하이브리드가 맞다.

### Toss/PG

`data/toss_sync_gap.md` 기준 예전 분석에서 `tb_sales_toss store=coffee`와 2025 엑셀 Toss 결제는 기간이 서로 달라 직접 비교가 틀어졌다.

| 항목 | 상태 |
|---|---|
| 2025 엑셀 Toss 결제 | 2024-11-21 ~ 2025-12-31 범위 |
| PG `tb_sales_toss store=coffee` | 2026-01-01 이후 중심 |
| 결론 | "Toss sync가 37%만 맞다"가 아니라, 기간 범위가 달랐던 문제 |
| 다음 | 2024-11-01 이후 coffee Toss backfill 또는 엑셀 결제내역과의 정합성 대조 필요 |

### NPay

기존 `backend/scripts/reconcile-coffee-ga4-naverpay.py`는 coffee GA4 BigQuery purchase 중 NPay transaction을 조회하고 Naver Commerce API와 대조하려는 스크립트다.

현재 로컬 실행 결과:

```bash
python3 scripts/reconcile-coffee-ga4-naverpay.py --startSuffix 20260423 --endSuffix 20260429 --json --maxProbeOrders 3
```

결과:

```text
ModuleNotFoundError: No module named 'bcrypt'
```

판단:

1. 스크립트 경로는 이미 있다.
2. 로컬 Python dependency 정리가 필요하다.
3. 더 중요한 blocker는 Naver Commerce API 스토어 권한이다. 기존 biocom 스코프로 coffee NPay 주문을 조회하면 권한 오류가 날 가능성이 높다.

## 왜 더클린커피가 좋은 비교군인가

biocom NPay 프로젝트에서 현재 가장 어려운 부분은 `GA4 raw에 이미 들어갔는지`를 BigQuery로 검증하는 것이다. biocom은 BigQuery 권한 문제가 남아 있어 TJ님 수동 쿼리에 의존했다.

더클린커피는 반대다. BigQuery raw export가 이미 fresh다. 따라서 아래 검증을 자동화할 수 있다.

| 검증 | biocom | 더클린커피 |
|---|---|---|
| GA4 raw purchase 조회 | 권한 문제로 제한 | 가능 |
| transaction_id 전체 검색 | TJ 수동 query 필요 | Codex read-only 가능 |
| NPay 버튼 클릭 후 미복귀 여부 | 수동 테스트 필요 | GA4 raw/event path로 더 빠르게 추정 가능 |
| `already_in_ga4` guard | 수동 robust query 기반 | 자동화 가능 |
| schema 확인 | 일부 외부 의존 | 같은 GA4 export schema로 바로 확인 가능 |

따라서 coffee는 단순히 "또 다른 사이트"가 아니라, biocom/AIBIO 공통 데이터 정합성 harness를 검증하는 실험장으로 쓸 수 있다.

## 재사용할 biocom NPay 규칙

| biocom에서 얻은 규칙 | coffee 적용 방식 |
|---|---|
| Imweb `order_number`와 NPay `channel_order_no`를 둘 다 본다 | coffee도 GA4 transaction_id/운영 주문번호/NPay 외부주문번호를 모두 검색 |
| `already_in_ga4`가 unknown이면 전송 후보에서 제외한다 | coffee는 BigQuery 접근 가능하므로 unknown을 줄일 수 있음 |
| 배송비 때문에 금액이 다른 경우는 mismatch가 아니라 `shipping_reconciled`일 수 있다 | coffee도 상품가/배송비/최종결제금액을 분리 |
| ambiguous는 절대 전송 후보가 아니다 | coffee도 A급/B급/ambiguous 분류 유지 |
| manual_test_order는 전송 제외 | coffee 테스트 결제 시 별도 label 필요 |
| 실제 전송 전 `dry-run`을 먼저 만든다 | coffee도 read-only report부터 생성 |

## Primary / Cross-check / Fallback 기준

질문별로 정본을 다르게 둔다. 하나의 DB를 전체 정답으로 보지 않는다.

| 질문 | Primary | Cross-check | Fallback | Confidence |
|---|---|---|---|---:|
| GA4에 purchase가 들어왔는가 | BigQuery `analytics_326949178.events_*` | GA4 Data API | Tag Assistant/Realtime | 92% |
| 실제 결제가 있었는가 | 운영 주문/결제 원장, 결제내역 엑셀 | Toss operational, PlayAuto operational | local SQLite mirror | 78% |
| NPay 실제 주문인가 | Naver Commerce API 또는 NPay 정산/주문 엑셀 | Imweb raw `channel_order_no`, GA4 transaction pattern | 금액/시간/상품 weak match | 62% |
| 고객 LTV/재구매는 누가 정본인가 | 2025/2024 엑셀 phone | 운영 회원/주문 DB | masked PlayAuto | 83% |
| ROAS 비교는 언제 가능한가 | 광고 API + confirmed order + GA4 guard 같은 window | BigQuery source/medium | 로컬 snapshot | 68% |

## Phase0-Sprint1

이름: 프로젝트 판단과 안전선  
담당: Codex  
상태: 우리 100% / 운영 0%

목표:

더클린커피 데이터 정합성 프로젝트를 시작할지 판단하고, 운영 변경 금지선을 먼저 고정한다.

완료한 것:

1. `docurule.md`, `AGENTS.md`, 기존 data/naver 문서 규칙을 확인했다.
2. 더클린커피 BigQuery 접근 가능성과 biocom BigQuery 권한 문제의 차이를 확인했다.
3. 현재 단계는 read-only 분석만 허용한다고 문서에 명시했다.

100%까지 남은 것:

현재 sprint는 문서 기준 완료다. 운영 0%인 이유는 이 sprint가 운영 반영이 아니라 안전선 확정이기 때문이다.

금지선:

- 운영 DB write 금지
- DB schema 변경 금지
- GA4/Meta/TikTok/Google Ads purchase 전송 금지
- NPay dispatcher 운영 배포 금지
- 외부 광고 플랫폼 설정 변경 금지

## Phase1-Sprint2

이름: Source freshness 기준선  
담당: Codex  
상태: 우리 70% / 운영 0%

목표:

분석에 쓸 데이터 소스가 최신인지 확인하고, stale source를 정본에서 제외한다.

완료한 것:

1. 2026-04-30 23:52 KST에 `check-source-freshness.ts --json`을 read-only로 실행했다.
2. 더클린커피 BigQuery `events_20260429`가 fresh임을 확인했다.
3. local Imweb/Toss/attribution ledger가 stale 또는 sparse임을 확인했다.
4. 운영 Postgres `toss_operational`, `playauto_operational`은 watch 상태이나 read-only cross-check에 쓸 수 있음을 확인했다.

100%까지 남은 것:

| 남은 일 | 왜 필요한가 | 어떻게 할 것인가 | 완료 기준 |
|---|---|---|---|
| 최신 7일 BigQuery purchase summary 생성 | 현재 freshness는 source 상태만 말하고, 구매 이벤트 상세는 말하지 않는다 | `events_*`에서 event_date, transaction_id, purchase_revenue, item_name, traffic source를 group by | 최근 7일 purchase/transaction_id 표 생성 |
| coffee 운영 주문 source의 site filter 확정 | 운영 Postgres가 3사이트 혼합이면 coffee row만 골라야 한다 | `store`, `site`, order prefix, domain 컬럼을 확인 | coffee 주문 추출 조건 문서화 |
| source freshness 리포트 자동화 | 매번 수동 판단하면 운영 루틴으로 못 간다 | `check-source-freshness.ts` 결과에서 coffee section만 markdown으로 출력 | 1명도 오판 없이 freshness/정본 선택 가능 |

## Phase1-Sprint3

이름: 2025 엑셀 원장화 검토  
담당: Codex + TJ  
상태: 우리 75% / 운영 0%

목표:

더클린커피 과거 주문/LTV/재구매 분석의 primary source를 정한다.

완료한 것:

1. 2025 주문 엑셀 구조를 이미 분석했다.
2. 16,454행, 11,018 고유 주문번호, 4,089 고유 전화번호, 거래종료 매출 279,093,357원을 확인했다.
3. API 단독보다 엑셀 + API 하이브리드가 맞다는 결론이 있다.

100%까지 남은 것:

| 남은 일 | 왜 필요한가 | 어떻게 할 것인가 | 완료 기준 |
|---|---|---|---|
| 2025 결제내역 엑셀 확보 | 주문 엑셀만으로는 결제수단/환불/정산 검증이 부족하다 | TJ님이 아임웹 결제내역 다운로드 | 결제수단별 매출과 주문 엑셀 매칭률 산출 |
| 2024 주문/결제 엑셀 확보 | 2024 이전 phone/LTV는 API/PG 마스킹 때문에 약하다 | TJ님이 연도별 다운로드 | 24개월 LTV/재구매 분석 가능 |
| import dry-run | 실제 DB에 넣기 전 중복/금액/컬럼 깨짐을 확인해야 한다 | local 임시 테이블 또는 CSV parse만 수행 | 행수/주문수/금액 합계가 원본과 일치 |
| local DB 적용 승인 | 로컬 DB write도 백업/dry-run 후 해야 한다 | 별도 승인 문서 작성 | TJ YES 이후 apply |

## Phase2-Sprint4

이름: GA4 BigQuery와 주문 원장 대조  
담당: Codex  
상태: 우리 35% / 운영 0%

목표:

GA4 purchase가 실제 주문과 얼마나 맞는지 확인한다. 이 결과가 coffee ROAS의 기준선이 된다.

완료한 것:

1. BigQuery source 접근 가능성을 확인했다.
2. 기존 `backend/scripts/reconcile-coffee-ga4-toss.ts`가 있어 GA4와 Toss 대조를 재사용할 수 있다.
3. 과거 문서 기준 2026-04-12 ~ 2026-04-17 window에서 GA4 purchase 123건, gross 5,588,498원, Toss-confirmed match 51건은 금액 차이 0원이었다.

100%까지 남은 것:

| 남은 일 | 왜 필요한가 | 어떻게 할 것인가 | 완료 기준 |
|---|---|---|---|
| 최신 window 재실행 | 기존 수치는 2026-04-17까지라 현재 판단에는 오래됐다 | 2026-04-23 ~ 2026-04-29 또는 최근 7일로 재실행 | GA4 purchase vs 운영 주문 match 표 |
| transaction_id robust search | GA4 ecommerce 필드뿐 아니라 event_params에도 들어갈 수 있다 | `ecommerce.transaction_id`, `event_params.transaction_id`, 전체 value 검색 | 주문 ID 누락 여부 확인 |
| payment method 분리 | NPay/Toss/가상계좌/기타가 섞이면 원인 분석이 흐려진다 | transaction_id pattern, event_params, item/order metadata 기준 분리 | payment_method별 match/amount gap |
| 금액 reconciliation | 배송비/할인/포인트 때문에 exact match만 보면 오판한다 | `final_exact`, `shipping_reconciled`, `discount_reconciled`, `cart_contains_item` 적용 | mismatch 사유별 집계 |

추천 쿼리 초안:

```sql
SELECT
  event_date,
  event_name,
  ecommerce.transaction_id AS ecommerce_transaction_id,
  (
    SELECT ep.value.string_value
    FROM UNNEST(event_params) ep
    WHERE ep.key = 'transaction_id'
  ) AS param_transaction_id,
  COUNT(*) AS events,
  ROUND(SUM(COALESCE(ecommerce.purchase_revenue, 0))) AS purchase_revenue
FROM `project-dadba7dd-0229-4ff6-81c.analytics_326949178.events_*`
WHERE _TABLE_SUFFIX BETWEEN '20260423' AND '20260429'
  AND event_name = 'purchase'
GROUP BY 1,2,3,4
ORDER BY event_date DESC, purchase_revenue DESC;
```

## Phase2-Sprint5

이름: Coffee NPay 실제 주문 매칭  
담당: Codex + TJ  
상태: 우리 25% / 운영 0%

목표:

더클린커피 NPay 버튼 클릭/GA4 purchase/실제 NPay 주문을 분리한다.

완료한 것:

1. coffee GA4 BigQuery에서 NPay transaction을 뽑는 스크립트가 존재한다.
2. biocom NPay에서 얻은 `channel_order_no`와 `order_number` 분리 규칙을 coffee에도 적용할 수 있다.
3. NPay API 권한이 핵심 blocker라는 점을 확인했다.

100%까지 남은 것:

| 남은 일 | 왜 필요한가 | 어떻게 할 것인가 | 완료 기준 |
|---|---|---|---|
| Python 실행 환경 정리 | 기존 NPay script가 `bcrypt` 누락으로 실행되지 않았다 | backend Python dependency 설치 방식 확인 후 실행 | script가 JSON 출력까지 도달 |
| Naver seller/API scope 확인 | coffee NPay actual order를 조회하려면 coffee 스토어 권한이 필요하다 | TJ님이 네이버 커머스 권한 확인 | sample NPay order 1건 read 성공 |
| GA4 NPay transaction 추출 | GA4에는 들어왔는데 실제 주문과 맞는지 봐야 한다 | BigQuery purchase 중 NPay pattern 추출 | transaction_id, value, item, time 표 |
| 운영 주문과 대조 | GA4만 보고 실제 구매라고 확정하면 안 된다 | PlayAuto/Imweb/Naver 원장과 금액/시간/상품 대조 | strong/B급/ambiguous/purchase_without_order 분리 |

주의:

coffee NPay는 BigQuery 접근이 되므로 `already_in_ga4` guard는 biocom보다 좋다. 하지만 실제 NPay 주문 원장이 막히면 `GA4에 있다`는 사실만 확인될 뿐, confirmed purchase 정본으로는 부족하다.

## Phase3-Sprint6

이름: Coffee NPay intent 장부  
담당: Codex  
상태: 우리 20% / 운영 0%

목표:

더클린커피도 NPay 버튼이 외부에 노출되어 있으므로, 버튼 클릭과 실제 결제를 분리하는 intent 장부를 준비한다.

완료한 것:

1. biocom에서 `npay_intent_log` 수집, 30초 dedupe, `ga_session_id` 추출, `already_in_ga4` guard 패턴을 검증했다.
2. coffee는 같은 아임웹/NPay 구조일 가능성이 있어 동일 패턴을 재사용할 수 있다.

100%까지 남은 것:

| 남은 일 | 왜 필요한가 | 어떻게 할 것인가 | 완료 기준 |
|---|---|---|---|
| coffee 버튼 DOM 조사 | selector가 biocom과 다를 수 있다 | Playwright/curl/브라우저로 NPay button DOM과 href/form 구조 확인 | 안정 selector 1개 이상 |
| site 분리 저장 | biocom intent와 섞이면 ROAS가 망가진다 | `site='thecleancoffee'`, domain, page_location, product_idx 저장 | site filter로 분리 조회 가능 |
| GTM/스크립트 배포 전 preview | live publish 전 compiler와 network를 확인해야 한다 | GTM preview 또는 site custom script preview | 1회 click -> 1 intent 저장 |
| no-purchase 분리 | 버튼 클릭만 한 사람을 purchase로 보면 안 된다 | 24시간 grace 후 confirmed order 없는 intent를 `clicked_no_purchase`로 분리 | 상품별 미결제 리포트 생성 |

이 단계는 바로 운영 배포하지 않는다. 먼저 coffee GA4 BigQuery와 actual order 구조를 read-only로 닫은 뒤 진행한다.

## Phase3-Sprint7

이름: Meta/TikTok/ROAS 정합성  
담당: Codex + TJ  
상태: 우리 20% / 운영 0%

목표:

더클린커피 광고비, GA4, 실제 주문, NPay 미복귀 문제를 같은 window에서 비교한다.

완료한 것:

1. 과거 문서에서 coffee Meta API token 만료 가능성을 확인했다.
2. `SITE_ACCOUNTS`에 더클린커피 Meta account mapping은 존재한다.
3. BigQuery가 열려 있으므로 GA4 측 raw purchase guard는 좋다.

100%까지 남은 것:

| 남은 일 | 왜 필요한가 | 어떻게 할 것인가 | 완료 기준 |
|---|---|---|---|
| Meta token freshness 확인 | token 만료 상태면 spend/ROAS 비교가 무의미하다 | coffee account `act_654671961007474` API 호출 | 최근 7일 spend 조회 성공 |
| TikTok 식별값 확인 | NPay 복구를 TikTok까지 확장하려면 `ttclid`, `_ttp`가 필요하다 | GTM/landing cookie/event_params 확인 | TikTok attribution key presence 표 |
| 광고비 window 고정 | 주문 window와 광고 window가 다르면 ROAS 오판 | KST 날짜 기준 7일/14일 고정 | spend, click, purchase, revenue 같은 window |
| 전환 전송 승인선 | 광고 플랫폼에 잘못 보내면 학습이 망가진다 | GA4 -> Meta -> TikTok -> Google Ads 순으로 제한 테스트 | 각 플랫폼별 approval gate 문서 |

## Phase4-Sprint8

이름: 공통 Growth Data Harness 편입  
담당: Codex + Claude  
상태: 우리 25% / 운영 0%

목표:

biocom NPay에서 만든 harness 개념을 coffee에도 적용한다.

완료한 것:

1. biocom에는 `read-only phase`, `dispatcher dry-run`, `BigQuery guard`, `manual_test_order exclusion`, `A/B/ambiguous`, `human approval` 루프가 생겼다.
2. coffee는 BigQuery 접근 가능하므로 harness의 guard 부분을 더 깔끔하게 검증할 수 있다.

100%까지 남은 것:

| 남은 일 | 왜 필요한가 | 어떻게 할 것인가 | 완료 기준 |
|---|---|---|---|
| coffee context pack | 에이전트가 매번 문서를 뒤지면 실수한다 | `harness/coffee-data/CONTEXT_PACK.md` 초안 | source/window/key 규칙 한 장 |
| verify checklist | 전송/DB write가 실수로 섞이면 안 된다 | no-send/no-write/auditor checklist 작성 | PR/commit 전 자동 점검 |
| eval log schema | 숫자가 바뀔 때마다 근거를 추적해야 한다 | source, window, freshness, confidence 컬럼 고정 | 모든 보고서에 동일 schema |
| lessons-to-rules | biocom에서 배운 규칙을 coffee와 AIBIO에 재사용해야 한다 | shipping_reconciled, channel_order_no, robust search 등 rule화 | 승인된 rule 목록 |

## Coffee 전용 dry-run 리포트 컬럼 초안

| 컬럼 | 의미 |
|---|---|
| `site` | `thecleancoffee` 고정 |
| `order_number` | Imweb/운영 주문번호 |
| `channel_order_no` | NPay 외부 주문번호가 있으면 별도 저장 |
| `ga4_transaction_id` | GA4 BigQuery에서 찾은 transaction_id |
| `ga4_event_time_kst` | GA4 purchase 발생 시각 |
| `order_paid_at_kst` | 실제 결제완료 시각 |
| `time_gap_minutes` | intent/event/order 간 시간차 |
| `order_payment_amount` | 최종 결제금액 |
| `item_total` | 상품 합계 |
| `delivery_price` | 배송비 |
| `discount_amount` | 할인/포인트 |
| `amount_match_type` | `final_exact`, `shipping_reconciled`, `discount_reconciled`, `quantity_reconciled`, `none` |
| `already_in_ga4` | `present`, `robust_absent`, `unknown` |
| `match_grade` | `A_strong`, `B_strong`, `ambiguous`, `purchase_without_ga4`, `ga4_without_order` |
| `send_candidate` | 지금은 항상 `N` |
| `block_reason` | `read_only_phase`, `unknown_npay_truth`, `ambiguous`, `already_in_ga4_present` 등 |

## BigQuery robust guard 쿼리 초안

특정 주문번호 또는 NPay 외부 주문번호가 GA4 raw 전체에 존재하는지 확인할 때 쓴다.

```sql
DECLARE ids ARRAY<STRING> DEFAULT [
  'ORDER_NUMBER_HERE',
  'CHANNEL_ORDER_NO_HERE'
];

SELECT
  _TABLE_SUFFIX AS table_suffix,
  event_name,
  event_timestamp,
  ecommerce.transaction_id AS ecommerce_transaction_id,
  (
    SELECT ep.value.string_value
    FROM UNNEST(event_params) ep
    WHERE ep.key = 'transaction_id'
  ) AS param_transaction_id,
  (
    SELECT STRING_AGG(CONCAT(ep.key, '=', COALESCE(
      ep.value.string_value,
      CAST(ep.value.int_value AS STRING),
      CAST(ep.value.double_value AS STRING),
      CAST(ep.value.float_value AS STRING)
    )), ' | ')
    FROM UNNEST(event_params) ep
    WHERE COALESCE(
      ep.value.string_value,
      CAST(ep.value.int_value AS STRING),
      CAST(ep.value.double_value AS STRING),
      CAST(ep.value.float_value AS STRING)
    ) IN UNNEST(ids)
  ) AS matched_event_params
FROM `project-dadba7dd-0229-4ff6-81c.analytics_326949178.events_*`
WHERE _TABLE_SUFFIX BETWEEN '20260423' AND '20260429'
  AND (
    ecommerce.transaction_id IN UNNEST(ids)
    OR EXISTS (
      SELECT 1
      FROM UNNEST(event_params) ep
      WHERE COALESCE(
        ep.value.string_value,
        CAST(ep.value.int_value AS STRING),
        CAST(ep.value.double_value AS STRING),
        CAST(ep.value.float_value AS STRING)
      ) IN UNNEST(ids)
    )
  )
ORDER BY event_timestamp DESC;
```

## 지금 Codex가 더 진행 가능한 일

컨펌 없이 가능한 작업:

1. 더클린커피 BigQuery 최근 7일 purchase summary를 read-only로 생성.
2. coffee GA4 transaction_id robust search 쿼리/스크립트 초안 작성.
3. existing `reconcile-coffee-ga4-toss.ts`를 최신 window로 실행하고 리포트화.
4. `reconcile-coffee-ga4-naverpay.py` 실행 환경을 정리하거나, 동일 로직을 TypeScript read-only script로 옮기는 초안 작성.
5. coffee dry-run markdown/API schema 초안 작성.
6. 기존 2025 엑셀 import dry-run 검증 스크립트 점검.

컨펌 또는 TJ 작업이 필요한 것:

1. 더클린커피 Naver Commerce API 권한 확인.
2. 더클린커피 Meta token 갱신 또는 새 token 공유.
3. 2025 결제내역 엑셀과 2024/2023 주문/결제 엑셀 다운로드.
4. local DB에 엑셀을 실제 import하는 단계 승인.
5. GTM/live script publish 승인.
6. GA4/Meta/TikTok/Google Ads 전환 전송 승인.

## 추천 실행안

추천안 A: `BigQuery-first read-only 검증`부터 시작한다.

| 안 | 설명 | 장점 | 리스크 | 추천 |
|---|---|---|---|---|
| A. BigQuery-first | GA4 raw purchase와 운영 주문 원장을 먼저 대조 | 접근 가능한 데이터를 바로 활용, biocom보다 빠름 | NPay actual order 권한 전에는 NPay truth가 약함 | 추천 |
| B. Excel-first | 2025/2024 엑셀을 먼저 정리 | LTV/재구매에는 강함 | GA4/NPay ROAS 문제 해결은 늦어짐 | 병행 추천 |
| C. NPay intent-first | 커피에도 NPay button intent를 바로 심음 | 미결제자 분리 가능 | 실제 주문 원장/GA4 기준 없이 심으면 운영 부담 | 아직 보류 |
| D. ROAS-first | Meta/TikTok spend와 매출 비교부터 시작 | 경영 지표에 바로 가까움 | token/source freshness가 안 닫히면 오판 | 보류 |

Codex 추천: A + B 병행.  
자신감: 86%.

낮춘 이유:

1. coffee BigQuery는 열려 있지만, NPay 실제 주문 원장 권한은 아직 확인되지 않았다.
2. local Imweb/Toss/attribution ledger는 stale이다.
3. Meta token freshness가 불확실하다.

그래도 시작을 추천하는 이유:

1. BigQuery가 열려 있어 `already_in_ga4` guard 자동화가 가능하다.
2. 2025 엑셀 덕분에 historical truth를 만들 수 있다.
3. biocom에서 만든 NPay/amount/channel_order_no 규칙을 검증할 좋은 비교군이다.

## 1차 성공 기준

| 기준 | Go 조건 |
|---|---|
| BigQuery freshness | latest daily table age 48h 이하 |
| GA4 purchase extraction | 최근 7일 purchase transaction_id 95% 이상 추출 |
| 주문 원장 대조 | GA4 purchase 중 actual order match rate 산출 |
| NPay 분리 | NPay/Toss/기타 결제수단을 최소 80% 이상 분류 |
| 금액 reconciliation | mismatch를 exact/shipping/discount/cart/none으로 분류 |
| no-send guard | report 단계에서 `send_candidate=N` 유지 |
| 문서 품질 | source, window, freshness, confidence가 모든 숫자에 붙음 |

## 최종 판단

더클린커피는 지금 데이터 정합성 프로젝트를 시작하는 것이 맞다.

단, 첫 목표는 광고 플랫폼 전송 복구가 아니다. 첫 목표는 **GA4 BigQuery가 열려 있는 사이트에서 실제 주문/결제 원장과 GA4 purchase가 얼마나 맞는지 read-only로 닫는 것**이다.

커피에서 이 루프가 안정화되면 biocom NPay, AIBIO 리드/예약 원장, 전사 Growth Data Harness까지 같은 규칙으로 확장할 수 있다.
