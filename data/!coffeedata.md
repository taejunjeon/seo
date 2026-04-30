# 더클린커피 데이터 정합성 프로젝트 검토

작성 시각: 2026-04-30 23:51 KST  
최신 read-only 확인: 2026-05-01 02:03 KST
문서 성격: 검토안 + 실행 설계안  
대상 사이트: `thecleancoffee.com`, 더클린커피 아임웹/GA4/BigQuery/NPay/ROAS  
관련 문서: [[!datacheckplan]], [[!bigquery]], [[iamweb_excel_backfill_review]], [[toss_sync_gap]], [[roasphase]], [[naver/!npayroas|biocom NPay ROAS 정합성 계획]], [[coffee-ga4-baseline-20260501|더클린커피 GA4 BigQuery 기준선 20260501]], [[coffee-imweb-operational-readonly-20260501|더클린커피 아임웹/운영 DB Read-only 주문 원장 대조]], [[naver/npay-api-mcp-review-20260501|네이버페이 API와 MCP 검토]]
Primary source: Imweb v2 API `IMWEB_API_KEY_COFFEE`, GA4 BigQuery `project-dadba7dd-0229-4ff6-81c.analytics_326949178`, 운영 Postgres `tb_sales_toss`, `tb_playauto_orders`, 더클린커피 아임웹 엑셀
Cross-check: local SQLite `imweb_orders`, `toss_transactions`, existing reconciliation scripts, Naver Commerce API scope check  
Freshness: Imweb v2 API 2026-05-01 02:02 KST read-only 실행, GA4/운영 DB 2026-05-01 00:52 KST 기준
Confidence: 89%

## 다음 할일

| 순서 | 상태 | 담당 | 할 일 | 왜 하는가 | 어떻게 하는가 | 컨펌 필요 |
|---:|---|---|---|---|---|---|
| 1 | 완료 | Codex | 더클린커피 GA4 BigQuery 기준선을 최신 7일로 뽑는다 | coffee는 BigQuery 접근 가능하므로 GA4 purchase/raw event를 정본 guard로 쓸 수 있는지 먼저 확인해야 한다 | `coffee-ga4-baseline.ts`로 `events_20260423`~`events_20260429` purchase, transaction_id, item, page, source를 집계했다. 결과는 [[coffee-ga4-baseline-20260501]]에 기록했다 | NO, read-only |
| 2 | 완료 | Codex | GA4 purchase transaction_id와 운영/아임웹 주문 원장 후보를 read-only로 대조한다 | GA4가 실제 주문을 얼마나 반영하는지 알아야 NPay/ROAS 복구 필요성을 판단할 수 있다 | `tb_sales_toss store=coffee`와 대조해 non-NPay 후보 50건 exact Imweb match를 확인했고, Imweb v2 API로 NPay actual order 60건을 확인했다. 상세는 [[coffee-imweb-operational-readonly-20260501]] | NO, read-only |
| 3 | 완료 | Codex | coffee용 NPay dry-run 리포트 스펙을 만든다 | biocom에서 만든 `intent -> confirmed order -> BigQuery guard` 구조를 커피에도 재사용할 수 있다 | [[coffee-ga4-baseline-20260501]]에 `order_number`, `channel_order_no`, `amount_match_type`, `already_in_ga4`, `match_grade`, `send_candidate=N` 스키마를 넣었다 | NO, 문서/코드 초안 |
| 4 | 대기 | TJ | 더클린커피 네이버 판매자/API 권한 여부를 확인한다 | 아임웹/호스팅사 사용 가맹점은 주문관리/정산 API가 제한될 수 있어 공식 답변이 필요하다 | [[naver/npay-api-mcp-review-20260501]]의 문의 문구로 네이버 기술지원에 주문형 API 가능 여부를 확인한다 | YES, 외부 계정 작업 |
| 5 | 부분 완료 | Codex | GA4 NPay형 58건과 Imweb NPay actual 60건을 주문별로 분해한다 | GA4에 `NPAY - ...` purchase가 있어도 실제 NPay 결제완료인지, 버튼/데이터레이어 purchase 오탐인지 확정해야 한다 | Imweb v2 API `type=npay`를 primary로 두고, PlayAuto 상품명과 GA4 item/time/amount를 read-only 조인했다. 현재 결과는 strong 29, probable 2, ambiguous 29 | NO, read-only |
| 6 | 대기 | Codex | 2025 더클린커피 엑셀을 정합성 원장으로 쓰는 import dry-run을 설계한다 | 커피는 PG/Toss보다 엑셀의 비마스킹 phone/이메일/배송/결제수단 정보 가치가 크다 | 기존 `data/coffee/기본_양식_20260424133106.xlsx` 기준 schema, 중복키, 금액 reconciliation 규칙을 문서화한다 | NO, dry-run까지 |
| 7 | 대기 | TJ | 2025 결제내역 엑셀과 2024 주문/결제 엑셀 다운로드를 준비한다 | 2025 주문 엑셀만으로는 결제수단/환불/정산 검증이 부족하고, 2024 이전 LTV는 phone 마스킹 문제가 있다 | 아임웹 관리자에서 더클린커피 결제내역/주문내역을 연도별로 다운로드한다 | YES |
| 8 | 부분 완료 | Codex | coffee NPay actual vs GA4 NPay형 mismatch 2건/103,000원을 분해한다 | Imweb actual NPay와 GA4 NPay형 purchase 간 차이가 보여 ROAS 정합성의 핵심 차이를 먼저 닫을 수 있다 | `coffee-imweb-operational-readonly.ts`에 `mismatchSummary`, `amount_match_type`, `ambiguousReasons`를 추가했다. 남은 일은 29건 ambiguous를 주문 단위로 줄이는 것이다 | NO, read-only |
| 9 | 보류 | Codex | Meta/TikTok ROAS 정합성은 source freshness가 닫힌 뒤 재개한다 | 커피 Meta 토큰/운영 원장 freshness가 불안정하면 ROAS 비교가 오판된다 | token, BigQuery, 주문 원장, Toss/Excel freshness를 같은 window로 맞춘 뒤 비교한다 | 부분 YES, token 갱신 필요 가능 |

## 10초 요약

결론은 **YES: 더클린커피 데이터 정합성 프로젝트는 네이버 API를 기다리지 않고 아임웹 API primary로 계속 진행할 수 있다**.

이유는 세 가지다.

1. 더클린커피는 biocom과 달리 GA4 BigQuery raw export에 현재 접근 가능하다. 2026-05-01 00:50 KST 기준 `events_20260429`가 fresh이고, 2026-04-23~2026-04-29 purchase는 108건, distinct transaction_id도 108건이다.
2. Imweb v2 API `IMWEB_API_KEY_COFFEE`가 정상 동작한다. 같은 window에서 전체 주문 113건, 4,699,767원과 NPay actual order 60건, 2,462,300원을 확인했다.
3. Toss/일반 결제 후보는 운영 원장 대조가 잘 된다. GA4 non-NPay 후보 50건은 Imweb `order_no`와 exact match되고, `tb_sales_toss store=coffee`와도 대체로 맞는다.
4. 아임웹 구조가 유사하므로 biocom NPay ROAS에서 만든 `order_number + channel_order_no`, `already_in_ga4 guard`, `amount_match_type`, `A급/B급/ambiguous` 규칙을 재사용할 수 있다.
5. 더클린커피는 2025년 아임웹 엑셀에 비마스킹 phone/이메일/배송/결제 정보가 있어, LTV와 주문 정합성 분석의 기준 데이터로 쓰기 좋다.

다만 바로 광고 전환 복구를 열면 안 된다. GA4에 `NPAY - ...` transaction_id 패턴 purchase 58건이 있고, Imweb actual NPay 주문은 60건이다. 숫자는 가깝지만 GA4 transaction_id가 Imweb `order_no`나 NPay `channel_order_no`가 아니므로 주문 단위 exact match는 안 된다. 과거분은 금액/시간/상품명 기준으로 보수적으로 분해해야 하며, 자동 전송은 여전히 금지다.

## 2026-05-01 Imweb API / 운영 DB 기준선 업데이트

상세 리포트: [[coffee-imweb-operational-readonly-20260501]]

| 항목 | 결과 | 해석 |
|---|---:|---|
| window | 2026-04-23 ~ 2026-04-29 KST | 최신 7일 기준 |
| Imweb API 전체 주문 | 113건, 4,699,767원 | coffee 주문 API primary 가능 |
| Imweb API NPay actual order | 60건, 2,462,300원 | `type=npay`, `channel_order_no` 60/60 |
| Imweb API card | 49건, 2,112,582원 | Toss/card 후보 |
| Imweb API virtual | 4건, 124,885원 | 가상계좌 후보 |
| GA4 purchase | 108건, 4,454,524원 | BigQuery 기준 |
| GA4 NPay형 purchase | 58건, 2,359,300원 | Imweb actual보다 2건/103,000원 낮음 |
| GA4 exact Imweb order_no match | 50건 | non-NPay 중심 |
| PlayAuto `아임웹-C` match | 105 orders | 상품명/배송상태 cross-check 가능 |
| `tb_iamweb_users` coffee order_no match | 0건 | coffee primary로 쓰면 안 됨 |

초기 NPay actual ↔ GA4 NPay형 후보:

| 분류 | 건수 | 판단 |
|---|---:|---|
| strong_match | 29 | read-only 후보, 전송 금지 |
| probable_match | 2 | 수동 검토 후보 |
| ambiguous | 29 | 자동 매칭 위험 |
| actual_without_ga4_candidate | 0 | 후보가 전혀 없는 actual order는 없음 |

ambiguous reason 요약:

| reason | 건수 | 해석 |
|---|---:|---|
| `low_score_gap` | 29 | 1등/2등 후보 차이가 작음 |
| `multiple_ga4_candidates` | 29 | 같은 actual order에 GA4 후보가 여러 개 붙음 |
| `same_amount_many_orders` | 24 | 동일 결제금액 주문이 반복됨 |
| `weak_time_gap` | 20 | 결제시각과 GA4 event 시각 차이가 큼 |
| `no_product_evidence` | 3 | PlayAuto 상품 증거가 없음 |
| `product_name_variant_or_no_overlap` | 3 | 상품명 overlap이 약함 |
| `amount_not_reconciled` | 2 | 금액이 배송비/할인/근사값으로도 설명되지 않음 |

해석: 네이버 API가 없어도 Imweb API로 actual order 확인은 가능하다. 그러나 과거 GA4 NPay형 purchase가 주문번호를 쓰지 않아 주문별 자동 매칭은 아직 약하다. 미래 데이터는 biocom처럼 NPay intent 장부를 붙이는 것이 더 정확하다.

## 2026-05-01 Read-only 기준선 업데이트

상세 리포트: [[coffee-ga4-baseline-20260501]]

| 항목 | 결과 | 해석 |
|---|---:|---|
| window | 2026-04-23 ~ 2026-04-29 KST | 최신 7일 daily table 기준 |
| GA4 purchase events | 108 | BigQuery 기준선 생성 완료 |
| distinct transaction_id | 108 | transaction_id 누락 0건 |
| missing user/session | 0 / 0 | user_pseudo_id, ga_session_id 품질 양호 |
| GA4 revenue | 4,454,524원 | GA4 purchase gross |
| NPay형 GA4 transaction | 58건, 2,359,300원 | 실제 주문 확정 전까지 복구/전송 판단 금지 |
| non-NPay GA4 후보 | 50건, 2,095,224원 | Toss/일반 결제 후보 |
| Toss confirmed order | 49건, 2,124,865원 | 운영 Postgres `tb_sales_toss store=coffee` |
| GA4 non-NPay 중 Toss confirmed exact match | 46건 | 금액 차이 0원, match rate 92.00% |
| GA4-only non-NPay | 1건, 36,500원 | PlayAuto/Imweb 추가 확인 필요 |
| Toss canceled인데 GA4 purchase 존재 | 3건 | refund/cancel 처리 확인 필요 |
| Toss-only confirmed | 3건 | GA4 누락 또는 transaction_id 차이 robust search 필요 |
| 네이버페이 MCP/API 검토 | [[naver/npay-api-mcp-review-20260501]] | MCP는 개발 보조, 주문 원장은 API/엑셀/운영 DB 필요 |

Auditor verdict: `PASS_WITH_NOTES`. 이번 작업은 BigQuery/운영 Postgres read-only 조회, 문서 작성, read-only 스크립트 추가만 수행했다. 운영 DB write, GTM publish, GA4/Meta/TikTok/Google Ads 전송, 운영 endpoint 배포는 0건이다.

## 현재 결론

| 질문 | 결론 | 자신감 | 이유 |
|---|---|---:|---|
| 더클린커피를 데이터 정합성 프로젝트로 착수할까 | YES | 90% | BigQuery 접근 가능, GA4 연결됨, Imweb API 주문 원장 접근 가능, 2025 엑셀 원장 있음 |
| biocom NPay 방식이 그대로 먹히나 | 부분 YES | 82% | Imweb `order_no + channel_order_no` 구조는 유사하지만 coffee 과거 GA4 NPay transaction_id가 주문번호가 아니라 후행 매칭은 더 약함 |
| BigQuery를 `already_in_ga4` guard로 쓸 수 있나 | YES | 94% | `analytics_326949178` daily export가 fresh이고 최근 7일 purchase 108건 모두 transaction_id가 있음 |
| Imweb API로 NPay actual order 확인이 가능한가 | YES | 89% | `type=npay`가 60건/2,462,300원을 반환했고 `channel_order_no`가 60/60 채워짐 |
| 지금 GA4/Meta/TikTok purchase 복구를 열까 | NO | 96% | actual order 확인은 가능하지만 과거 GA4 NPay 주문별 매칭이 ambiguous 29건이라 전송 금지 |
| 더클린커피가 biocom 문제 해결에 힌트를 줄 수 있나 | YES | 88% | 같은 GA4 export schema, 같은 아임웹/NPay 계열이면 BigQuery 쿼리와 매칭 규칙을 먼저 검증 가능 |

## Phase-Sprint 요약표

| Phase | Sprint | 이름 | 담당 | 상태(우리/운영) | 상세 |
|---|---|---|---|---|---|
| Phase0 | [[#Phase0-Sprint1]] | 프로젝트 판단과 안전선 | Codex | 100% / 0% | [[#Phase0-Sprint1]] |
| Phase1 | [[#Phase1-Sprint2]] | Source freshness 기준선 | Codex | 95% / 0% | [[#Phase1-Sprint2]] |
| Phase1 | [[#Phase1-Sprint3]] | 2025 엑셀 원장화 검토 | Codex + TJ | 75% / 0% | [[#Phase1-Sprint3]] |
| Phase2 | [[#Phase2-Sprint4]] | GA4 BigQuery와 주문 원장 대조 | Codex | 85% / 0% | [[#Phase2-Sprint4]] |
| Phase2 | [[#Phase2-Sprint5]] | Coffee NPay 실제 주문 매칭 | Codex + TJ | 70% / 0% | [[#Phase2-Sprint5]] |
| Phase3 | [[#Phase3-Sprint6]] | Coffee NPay intent 장부 | Codex | 20% / 0% | [[#Phase3-Sprint6]] |
| Phase3 | [[#Phase3-Sprint7]] | Meta/TikTok/ROAS 정합성 | Codex + TJ | 20% / 0% | [[#Phase3-Sprint7]] |
| Phase4 | [[#Phase4-Sprint8]] | 공통 Growth Data Harness 편입 | Codex + Claude | 45% / 0% | [[#Phase4-Sprint8]] |

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

더클린커피는 네이버 주문관리 API를 기다리지 않아도 Imweb v2 API로 NPay actual order를 확인할 수 있다.

검증 명령:

```bash
cd backend
npm exec tsx scripts/coffee-imweb-operational-readonly.ts -- --startSuffix=20260423 --endSuffix=20260429 --maxPages=8 --delayMs=1200 --json
```

결과:

| 항목 | 값 | 판단 |
|---|---:|---|
| Imweb API auth | 성공 | `IMWEB_API_KEY_COFFEE` / `IMWEB_SECRET_KEY_COFFEE` 사용 |
| 전체 주문 API | 113건, 4,699,767원 | 최신 7일 window covered |
| `type=npay` 주문 | 60건, 2,462,300원 | NPay actual order primary로 사용 가능 |
| `channel_order_no` 채움률 | 60/60 | NPay 외부 주문번호가 Imweb API에 들어옴 |
| GA4 NPay형 purchase | 58건, 2,359,300원 | actual보다 2건/103,000원 낮음 |
| `tb_iamweb_users` coffee order match | 0건 | coffee primary로 쓰면 안 됨 |

판단:

1. 더클린커피 NPay actual order primary는 현재 `Imweb v2 API /v2/shop/orders?type=npay`로 둔다.
2. Naver Commerce API는 공식 주문관리/정산 cross-check와 장기 자동화용이다. 권한 확보 전에도 read-only 정합성 작업은 진행 가능하다.
3. 기존 Python `reconcile-coffee-ga4-naverpay.py`는 dependency와 Naver API scope 전제가 있어 우선순위를 낮춘다. 동일 목적은 TypeScript read-only 스크립트로 대체한다.
4. 과거 GA4 NPay형 transaction_id는 `NPAY - ...` synthetic 값이라 Imweb `order_no` 또는 NPay `channel_order_no`와 exact match되지 않는다. 따라서 주문별 복구 전송 판단은 금액/시간/상품명 기반 dry-run을 거쳐야 한다.

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
| 실제 결제가 있었는가 | Imweb v2 API, 운영 주문/결제 원장, 결제내역 엑셀 | Toss operational, PlayAuto operational | local SQLite mirror | 86% |
| NPay 실제 주문인가 | Imweb v2 API `type=npay` | PlayAuto `아임웹-C`, Naver Commerce API 또는 NPay 정산/주문 엑셀 | GA4 transaction pattern + 금액/시간/상품 weak match | 89% |
| 고객 LTV/재구매는 누가 정본인가 | 2025/2024 엑셀 phone | 운영 회원/주문 DB | masked PlayAuto | 83% |
| ROAS 비교는 언제 가능한가 | 광고 API + Imweb/confirmed order + GA4 guard 같은 window | BigQuery source/medium | 로컬 snapshot | 72% |

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
상태: 우리 90% / 운영 0%

목표:

분석에 쓸 데이터 소스가 최신인지 확인하고, stale source를 정본에서 제외한다.

완료한 것:

1. 2026-05-01 00:50 KST에 `check-source-freshness.ts --json`을 read-only로 재실행했다.
2. 더클린커피 BigQuery `events_20260429`가 fresh임을 확인했다.
3. local Imweb/Toss/attribution ledger가 stale 또는 sparse임을 확인했다.
4. 운영 Postgres `toss_operational`, `playauto_operational`은 watch 상태이나 read-only cross-check에 쓸 수 있음을 확인했다.
5. 최신 7일 GA4 purchase summary를 [[coffee-ga4-baseline-20260501]]로 생성했다.

100%까지 남은 것:

| 남은 일 | 왜 필요한가 | 어떻게 할 것인가 | 완료 기준 |
|---|---|---|---|
| coffee 운영 주문 source의 site filter 확정 | 운영 Postgres가 3사이트 혼합이면 coffee row만 골라야 한다 | Toss는 `store=coffee`, PlayAuto는 `shop_name='아임웹-C'` 기준으로 쓰되, Imweb/회원 원장은 별도 컬럼 확인 | coffee 주문 추출 조건 3개 이상 문서화 |
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
상태: 우리 65% / 운영 0%

목표:

GA4 purchase가 실제 주문과 얼마나 맞는지 확인한다. 이 결과가 coffee ROAS의 기준선이 된다.

완료한 것:

1. BigQuery source 접근 가능성을 확인했다.
2. 기존 `backend/scripts/reconcile-coffee-ga4-toss.ts`로 최신 window를 read-only 재실행했다.
3. 신규 `backend/scripts/coffee-ga4-baseline.ts`로 GA4 purchase summary, source/page/item/payment pattern, robust search template, 운영 원장 후보를 한 번에 출력하게 했다.
4. 2026-04-23 ~ 2026-04-29 window에서 GA4 purchase 108건, distinct transaction_id 108건, revenue 4,454,524원을 확인했다.
5. GA4 non-NPay 후보 50건 중 46건이 Toss confirmed order와 금액 차이 0원으로 매칭됨을 확인했다.

100%까지 남은 것:

| 남은 일 | 왜 필요한가 | 어떻게 할 것인가 | 완료 기준 |
|---|---|---|---|
| GA4-only non-NPay 1건 확인 | GA4에는 있는데 Toss confirmed에는 없는 주문이 실제 주문인지 봐야 한다 | PlayAuto/Imweb 주문 원장과 transaction_id, 금액 36,500원, 결제시각을 대조 | `order_found` 또는 `ga4_orphan` 판정 |
| Toss canceled인데 GA4 purchase 존재 3건 확인 | 취소 주문이 purchase로 남으면 ROAS가 과대 계산된다 | Toss canceled order의 cancel 시각, GA4 refund/cancel event, PlayAuto 상태를 대조 | `refund_sent`, `purchase_needs_adjustment`, `expected_gap` 중 하나로 분류 |
| Toss-only confirmed 3건 확인 | 실제 결제는 있는데 GA4 purchase가 없으면 누락 복구 후보가 될 수 있다 | BigQuery robust search로 order_id와 event_params 전체 value를 검색 | `already_in_ga4_present` 또는 `robust_absent` 판정 |
| 금액 reconciliation 확장 | 배송비/할인/포인트 때문에 exact match만 보면 오판한다 | `final_exact`, `shipping_reconciled`, `discount_reconciled`, `cart_contains_item` 적용 | mismatch 사유별 집계 |

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
상태: 우리 70% / 운영 0%

목표:

더클린커피 NPay 버튼 클릭/GA4 purchase/실제 NPay 주문을 분리한다.

완료한 것:

1. coffee GA4 BigQuery에서 NPay형 transaction을 뽑는 TypeScript read-only 스크립트를 만들었다.
2. Imweb v2 API 인증과 주문 조회가 동작함을 확인했다.
3. `type=npay`로 2026-04-23~2026-04-29 NPay actual order 60건, 2,462,300원을 확인했다.
4. Imweb NPay order의 `channel_order_no`가 60/60 채워짐을 확인했다.
5. 같은 window의 GA4 NPay형 purchase 58건, 2,359,300원을 분리했다.
6. PlayAuto `아임웹-C`가 105개 주문에서 상품명/상태 cross-check를 제공함을 확인했다.
7. `tb_iamweb_users`는 coffee order_no 0건 매칭이므로 coffee primary로 쓰면 안 된다고 분리했다.
8. actual NPay order와 GA4 NPay형 purchase 매칭은 strong 29건, probable 2건, ambiguous 29건으로 분류했다.
9. `amount_match_type`을 `final_exact`, `shipping_reconciled`, `near_exact`, `none`으로 나눴고, 배송비 제외로 보이는 29건은 mismatch가 아니라 `shipping_reconciled`로 보정했다.
10. ambiguous reason을 `low_score_gap`, `multiple_ga4_candidates`, `same_amount_many_orders`, `weak_time_gap`, `no_product_evidence`, `product_name_variant_or_no_overlap`, `amount_not_reconciled`로 출력하게 했다.

100%까지 남은 것:

| 남은 일 | 왜 필요한가 | 어떻게 할 것인가 | 완료 기준 |
|---|---|---|---|
| mismatch 2건/103,000원 최종 원인 확정 | Imweb actual NPay 60건과 GA4 NPay형 58건 차이가 ROAS 오차의 핵심이다 | strong/probable을 제외한 29건 ambiguous를 시간/금액/상품명/PlayAuto 상태로 좁혀 `ga4_missing`, `cancel/refund`, `pattern_mismatch`로 분류 | 차이 2건이 주문번호 단위로 설명됨 |
| ambiguous 29건 축소 | ambiguous는 전송 금지라 후보가 많으면 복구 자동화가 어렵다 | 동일 금액 반복 주문을 결제시각, 상품명, channel_order_no, page_location 기준으로 재점수화 | ambiguous 29건 중 줄일 수 있는 것과 끝까지 수동 검토할 것을 분리 |
| A/B/ambiguous 기준 문서화 | 운영자와 광고 담당자가 같은 기준으로 판단해야 한다 | 현재 score, time_gap, amount_match_type, product_overlap 기준을 coffee dry-run schema에 고정 | `A_strong`, `B_strong`, `ambiguous` 기준표 완성 |
| Naver seller/API scope 확인 | Imweb API가 primary여도 네이버 공식 주문관리/정산 cross-check는 장기적으로 유용하다 | TJ님이 네이버 기술지원/호스팅사 경로로 주문형 API 가능 여부 확인 | sample NPay order 1건 read 성공 또는 불가 공식 답변 |
| 향후 intent 장부 설계 | 과거분은 GA4 synthetic transaction_id 때문에 자동 매칭이 약하다 | 미래분은 버튼 클릭 시 `client_id`, `ga_session_id`, product, page를 저장하는 coffee intent 초안을 설계 | live publish 전 preview 계획 완성 |

주의:

coffee NPay는 Imweb API로 actual order 원장을 볼 수 있고, BigQuery 접근도 되므로 `already_in_ga4` guard는 biocom보다 좋다. 다만 과거 GA4 NPay형 transaction_id가 actual order id가 아니라서 주문 단위 자동 복구 전송은 아직 금지다.

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
상태: 우리 45% / 운영 0%

목표:

biocom NPay에서 만든 harness 개념을 coffee에도 적용한다.

완료한 것:

1. biocom에는 `read-only phase`, `dispatcher dry-run`, `BigQuery guard`, `manual_test_order exclusion`, `A/B/ambiguous`, `human approval` 루프가 생겼다.
2. coffee는 BigQuery 접근 가능하므로 harness의 guard 부분을 더 깔끔하게 검증할 수 있다.
3. NPay recovery `VERIFY.md`에 false positive가 많은 `rg` 검사 보완을 추가했다. 문서 언급과 실행 가능한 새 전송 경로를 분리해서 보고한다.
4. `shipping_reconciled`는 dry-run classification에 쓰되, 실제 limited send 후보로 쓸 때는 7일 후보정 또는 TJ 승인안에서 별도 확인하도록 `RULES.md`와 `APPROVAL_GATES.md`에 명시했다.
5. 하네스 완료 보고에 Auditor verdict 형식을 고정했다.

100%까지 남은 것:

| 남은 일 | 왜 필요한가 | 어떻게 할 것인가 | 완료 기준 |
|---|---|---|---|
| coffee context pack | 에이전트가 매번 문서를 뒤지면 실수한다 | `harness/coffee-data/CONTEXT_PACK.md` 초안 또는 NPay harness의 coffee section 확장 | source/window/key 규칙 한 장 |
| coffee eval log schema | 숫자가 바뀔 때마다 근거를 추적해야 한다 | source, window, freshness, confidence 컬럼 고정 | 모든 coffee 보고서에 동일 schema |
| coffee auditor checklist | site filter, stale source, no-send/no-write를 coffee 전용으로 검사해야 한다 | NPay auditor에서 coffee hard fail 항목을 분리 | 작업 종료 전 PASS/PASS_WITH_NOTES 판정 가능 |
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
4. `coffee-imweb-operational-readonly.ts`를 확장해 NPay ambiguous reason과 mismatch 2건을 주문별로 출력.
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

추천안 A: `Imweb API + BigQuery-first read-only 검증`부터 시작한다.

| 안 | 설명 | 장점 | 리스크 | 추천 |
|---|---|---|---|---|
| A. Imweb API + BigQuery-first | Imweb actual order와 GA4 raw purchase를 먼저 대조 | 접근 가능한 데이터를 바로 활용, NPay actual order와 GA4 guard를 같이 봄 | 과거 GA4 NPay transaction_id가 주문번호가 아니라 주문별 자동 매칭이 약함 | 추천 |
| B. Excel-first | 2025/2024 엑셀을 먼저 정리 | LTV/재구매에는 강함 | GA4/NPay ROAS 문제 해결은 늦어짐 | 병행 추천 |
| C. NPay intent-first | 커피에도 NPay button intent를 바로 심음 | 미래 클릭/결제 분리 가능 | 현재 과거분 원장 대조가 끝나기 전 live publish하면 운영 부담 | 아직 보류 |
| D. ROAS-first | Meta/TikTok spend와 매출 비교부터 시작 | 경영 지표에 바로 가까움 | token/source freshness가 안 닫히면 오판 | 보류 |

Codex 추천: A + B 병행.  
자신감: 89%.

낮춘 이유:

1. NPay actual order는 Imweb API로 확인됐지만, 과거 GA4 NPay transaction_id가 주문번호가 아니라 order-level exact match가 약하다.
2. local Imweb/Toss/attribution ledger는 stale이다.
3. Meta token freshness가 불확실하다.

그래도 시작을 추천하는 이유:

1. Imweb API로 NPay actual order primary를 확보했다.
2. BigQuery가 열려 있어 `already_in_ga4` guard 자동화가 가능하다.
3. 2025 엑셀 덕분에 historical truth를 만들 수 있다.
4. biocom에서 만든 NPay/amount/channel_order_no 규칙을 검증할 좋은 비교군이다.

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
