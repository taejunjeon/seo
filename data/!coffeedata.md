# 더클린커피 데이터 정합성 프로젝트 검토

작성 시각: 2026-04-30 23:51 KST  
최신 read-only 확인: 2026-05-01 14:40 KST
문서 성격: 검토안 + 실행 설계안  
대상 사이트: `thecleancoffee.com`, 더클린커피 아임웹/GA4/BigQuery/NPay/ROAS  
관련 문서: [[!datacheckplan]], [[!bigquery]], [[!data_inventory|SEO 데이터 위치 인벤토리]], [[iamweb_excel_backfill_review]], [[toss_sync_gap]], [[roasphase]], [[naver/!npayroas|biocom NPay ROAS 정합성 계획]], [[coffee/!imwebcoffee_code_latest_0501|더클린커피 imweb 헤더/푸터 코드 정본]], [[coffee-imweb-tracking-flow-analysis-20260501|더클린커피 imweb 4 layer Tracking Flow 분석]], [[coffee-ga4-baseline-20260501|더클린커피 GA4 BigQuery 기준선 20260501]], [[coffee-imweb-operational-readonly-20260501|더클린커피 아임웹/운영 DB Read-only 주문 원장 대조]], [[coffee-ga4-robust-guard-20260501|더클린커피 GA4 Robust Guard]], [[coffee-npay-unassigned-ga4-guard-20260501|더클린커피 NPay unassigned GA4 Guard]], [[coffee-excel-import-dry-run-20260501|더클린커피 엑셀 Import Dry-run]], [[coffee-excel-ltv-dry-run-20260501|더클린커피 2024/2025 LTV Dry-run]], [[coffee-excel-payment-mismatch-2025-20260501|더클린커피 2025 결제 Mismatch 분해]], [[coffee-excel-payment-mismatch-2024-20260501|더클린커피 2024 결제 Mismatch 분해]], [[coffee-npay-intent-beacon-preview-design-20260501|더클린커피 NPay Intent Beacon Preview-only 설계안 (v0.4)]], [[coffee-npay-intent-beacon-preview-snippet-v04-20260501|더클린커피 NPay Intent Beacon Preview Snippet v0.4/v0.5/v0.6 분리본]], [[coffee-npay-intent-beacon-preview-snippet-all-in-one-20260501|더클린커피 NPay Intent Beacon Preview Snippet All-in-One (v0.4+v0.5+v0.6 통합 paste)]], [[coffee-npay-intent-uuid-preservation-test-20260501|더클린커피 NPay intent_uuid URL 보존 검증 가이드]], [[coffee-funnel-capi-cross-site-applicability-20260501|더클린커피 funnel-capi 발견의 Biocom 적용성 메모]], [[coffee-live-tracking-inventory-20260501|더클린커피 Live Tracking Inventory 2026-05-01]], [[coffee-source-freshness-meta-tiktok-20260501|더클린커피 Meta/TikTok Source Freshness]], [[coffee-dry-run-schema|더클린커피 Dry-run Schema]], [[harness/coffee-data/README|Coffee Data Harness]], [[harness/coffee-data/LIVE_TAG_INVENTORY|Coffee Live Tag Inventory template]], [[naver/npay-api-mcp-review-20260501|네이버페이 API와 MCP 검토]]
Primary source: Imweb v2 API `IMWEB_API_KEY_COFFEE`, GA4 BigQuery `project-dadba7dd-0229-4ff6-81c.analytics_326949178`, 운영 Postgres `tb_sales_toss`, `tb_playauto_orders`, 더클린커피 아임웹 엑셀
Cross-check: local SQLite `imweb_orders`, `toss_transactions`, existing reconciliation scripts, Naver Commerce API scope check  
Freshness: Imweb v2 API 2026-05-01 10:16 KST read-only 실행, GA4/운영 DB 2026-05-01 00:52 KST 기준
Confidence: 90%

## 다음 할일

| 순서 | Phase/Sprint | 상태 | 담당 | 할 일 | 왜 하는가 | 어떻게 하는가 | 상세 | 컨펌 필요 |
|---:|---|---|---|---|---|---|---|---|
| 1 | [[#Phase2-Sprint4]] | 완료 | Codex | 더클린커피 GA4 BigQuery 기준선을 최신 7일로 뽑는다 | coffee는 BigQuery 접근 가능하므로 GA4 purchase/raw event를 정본 guard로 쓸 수 있는지 먼저 확인해야 한다 | `coffee-ga4-baseline.ts`로 `events_20260423`~`events_20260429` purchase, transaction_id, item, page, source를 집계했다 | [[#Phase2-Sprint4]] / [[coffee-ga4-baseline-20260501]] | NO, read-only |
| 2 | [[#Phase2-Sprint4]] | 완료 | Codex | GA4 purchase transaction_id와 운영/아임웹 주문 원장 후보를 read-only로 대조한다 | GA4가 실제 주문을 얼마나 반영하는지 알아야 NPay/ROAS 복구 필요성을 판단할 수 있다 | `tb_sales_toss store=coffee`, Imweb v2 API, PlayAuto `아임웹-C`를 대조했다 | [[#Phase2-Sprint4]] / [[coffee-imweb-operational-readonly-20260501]] | NO, read-only |
| 3 | [[#Phase2-Sprint5]] | 완료 | Codex | coffee용 NPay dry-run 리포트 스펙을 만든다 | biocom에서 만든 `intent -> confirmed order -> BigQuery guard` 구조를 커피에도 재사용할 수 있다 | `order_number`, `channel_order_no`, `amount_match_type`, `already_in_ga4`, `match_grade`, `send_candidate=N` 컬럼을 고정했다 | [[#Phase2-Sprint5]] / [[coffee-dry-run-schema]] | NO, 문서/코드 초안 |
| 4 | [[#Phase2-Sprint5]] | 부분 진행 | TJ | 더클린커피 네이버 판매자/API 권한 여부를 확인한다 | 아임웹/호스팅사 사용 가맹점은 주문관리/정산 API가 제한될 수 있어 공식 답변이 필요하다 | Sandbox 키 4종(`npay_coffee_store_id` / `clientid` / `clientsecret` / `chainid`) 발급 완료, `.env` 256~260행에 present. 다음 액션은 `dl_techsupport@navercorp.com` 에 "아임웹 입점 가맹점도 Production 발급 가능한가" 메일 1통. 효용 추정은 47건 중 6건(≈13%)이므로 우선순위 낮음 — 자세히는 [[#네이버 주문관리 API 필요성 판단]] | [[#Phase2-Sprint5]] / [[#네이버 주문관리 API 필요성 판단]] / [[naver/npay-api-mcp-review-20260501]] | YES, 메일 1통 |
| 5 | [[#Phase2-Sprint5]] | 완료 | Codex | GA4의 NPay처럼 보이는 구매 이벤트 58건과 아임웹 NPay 실제 주문 60건을 주문별로 맞춰 본다 | GA4에 `NPAY - ...` purchase가 있어도 실제 NPay 결제완료인지, 버튼/데이터레이어 purchase 오탐인지 아직 확정되지 않았기 때문이다 | one-to-one 배정 42건, unassigned actual 18건(`expected_synthetic_gap` 8 / `stop_historical_recovery` 6 / `manual_review_only` 3 / `needs_naver_api_crosscheck` 1), ambiguous 29건 재점수(`expected_synthetic_gap` 19 / `needs_naver_api_crosscheck` 5 / `stop_historical_recovery` 3 / `manual_review_only` 2)까지 라벨링했다. 36/36 `robust_absent` 확인 | [[#Phase2-Sprint5]] / [[coffee-imweb-operational-readonly-20260501]] / [[coffee-npay-unassigned-ga4-guard-20260501]] | NO, read-only |
| 6 | [[#Phase1-Sprint3]] | 완료 | Codex | 2024/2025 더클린커피 주문/결제 엑셀을 정합성 원장 후보로 검증한다 | 커피는 PG/Toss보다 엑셀의 비마스킹 phone/이메일/배송/결제수단 정보 가치가 크다 | `coffee-excel-import-dry-run.ts`로 2025 주문/결제 join 11,018/11,018과 2024 join 1,987/1,987을 확인했다 | [[#Phase1-Sprint3]] / [[coffee-excel-import-dry-run-20260501]] | NO, dry-run only |
| 7 | [[#Phase1-Sprint3]] | 완료 | Codex | 더클린커피 주문/결제 엑셀 위치를 확인하고 인벤토리로 고정한다 | 이미 받은 엑셀을 다시 요청하면 작업이 꼬이고, stale/중복 파일을 정본으로 쓸 수 있다 | `data/coffee/coffee_orders_2024.xlsx`, `coffee_payments_2024.xlsx`, `coffee_orders_2025.xlsx`, `coffee_payments_2025.xlsx`가 실제 데이터 파일임을 확인했다. 2023 파일은 헤더-only다 | [[#Phase1-Sprint3]] / [[!data_inventory]] | NO |
| 8 | [[#Phase2-Sprint5]] | 부분 완료 | Codex | NPay 실제 주문과 GA4 NPay형 purchase의 2건/103,000원 차이를 분해한다 | Imweb actual NPay와 GA4 NPay형 purchase 간 차이가 보여 ROAS 정합성의 핵심 차이를 먼저 닫을 수 있다 | 2건/103,000원 차이는 one-to-one residual 기준으로 assigned delta 70,600원 + unassigned net delta 32,400원으로 쪼개졌다. 직접 주문번호 guard는 36/36 `robust_absent`다 | [[#Phase2-Sprint5]] / [[coffee-imweb-operational-readonly-20260501]] / [[coffee-npay-unassigned-ga4-guard-20260501]] | NO, read-only |
| 9 | [[#Phase3-Sprint7]] | 부분 완료 | Codex | Meta/TikTok ROAS 정합성은 source freshness가 닫힌 뒤 재개한다 | 커피 Meta 토큰/운영 원장 freshness가 불안정하면 ROAS 비교가 오판된다 | Meta/TikTok token freshness 와 last_7d insights 응답을 [[coffee-source-freshness-meta-tiktok-20260501]] 에 정리. Meta `act_654671961007474` last_7d spend 344,728원 정상, TikTok advertiser `7593201373714595856` 정상 (단, advertiser 단위 spend 는 BIOCOM+COFFEE 합산이라 campaign 분리 필요). 다음은 ROAS 단계 R1~R4 | [[#Phase3-Sprint7]] / [[coffee-source-freshness-meta-tiktok-20260501]] | 부분 YES, ROAS 송출 단계는 별도 승인 |
| 10 | [[#Phase4-Sprint8]] | 완료 | Codex | 더클린커피 전용 하네스 v0를 만든다 | biocom NPay 규칙을 커피에 적용할 때 site, source, stale, no-send 기준을 매번 다시 설명하지 않기 위해서다 | `harness/coffee-data/`에 context pack, rules, verify, auditor checklist, eval schema를 분리했다 | [[#Phase4-Sprint8]] / [[harness/coffee-data/README]] | NO, 문서형 하네스 |
| 11 | [[#Phase3-Sprint6]] | 완료 (v0.3) | Codex | 더클린커피 NPay 버튼 DOM 조사 + intent beacon preview-only 설계안을 작성한다 | 과거분 자동 매칭이 약하므로 미래분에서 click → 결제 사이의 의도를 분리해 두어야 한다. 다만 live publish 전 design + preview 절차 확정이 필요하다 | `shop_view/?idx=1` 정적 HTML 분석으로 PC `#naverPayWrap`, mobile `._btn_mobile_npay`, 공통 진입점 `SITE_SHOP_DETAIL.confirmOrderWithCartItems('npay', url)` 확인. v0.2 에 결제 시도 단위 intent_uuid + initDetail fallback + URL Query Param 보존 검증 분기 + 체크리스트형 시나리오 5개 추가. v0.3 에 site 의 funnel-capi v3 발견 반영, 진단 명령 A/B/C 묶음과 결과 분기 6종으로 sessionId/eid 재사용·공존 방향 정리 | [[#Phase3-Sprint6]] / [[coffee-npay-intent-beacon-preview-design-20260501]] / [[coffee-live-tracking-inventory-20260501]] | NO, 설계 + preview only |
| 13 | [[#Phase4-Sprint8]] | 완료 | Codex | live tracking inventory 하네스 추가 | 2026-05-01 chrome devtools 진단 중 site 에 이미 funnel-capi v3 가 운영 중이라는 사실을 뒤늦게 발견. 기존 wrapper/session/eid 체계를 무시하고 새로 박는 사고를 재발 방지하기 위해 preflight 단계가 필요했다 | [[harness/coffee-data/LIVE_TAG_INVENTORY|Coffee Live Tag Inventory template]] 신규 + [[coffee-live-tracking-inventory-20260501]] 첫 snapshot. AUDITOR_CHECKLIST 에 hard fail 2 + soft fail 2 추가 | [[#Phase4-Sprint8]] / [[harness/coffee-data/LIVE_TAG_INVENTORY]] | NO, 문서/하네스 |
| 12 | [[#Phase1-Sprint3]] | 완료 | Codex | 2024/2025 엑셀을 같은 dry-run 스크립트로 통합 LTV 비교 | 광고 ROAS 복구 전송 판단 외에도 LTV/재구매 분석에 엑셀이 가장 풍부하다 | `coffee-excel-ltv-dry-run.ts` 추가, NPay `거래개시` + 결제완료 금액 보정 후 2024/2025 통합 12,731건 / 476,696,364원, 고객 4,536명, 재구매2+ 1,747명, 2024→2025 잔존 59.06% 산출 | [[#Phase1-Sprint3]] / [[coffee-excel-ltv-dry-run-20260501]] | NO, dry-run only |

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

## GA4 NPay synthetic transaction_id 한계

NPay 매칭이 닫히지 않는 핵심 원인은 네이버 API 부재가 아니라 **GA4 의 NPay 형 purchase 이벤트 transaction_id 가 합성 키(synthetic id)** 라는 사실이다. 이걸 분리해서 봐야 한다.

### 무엇이 합성인가

| 시스템 | 주문번호 형태 | 예시 | 의미 |
|---|---|---|---|
| Imweb 측 order_no | 15자리 timestamp 기반 | `202604238847032` | 아임웹 내부 주문번호 (primary key) |
| NPay 측 channel_order_no | 16자리 timestamp 기반 | `2026042322051380` | NPay 측 외부 주문번호 (Imweb 가 받아 저장) |
| GA4 events 의 NPay 형 transaction_id | `NPAY - YYYYMMDDH - epoch_ms` | `NPAY - 202603127 - 1777286395026` | **위 두 키 어느 것과도 일치하지 않는 합성 키** |

GA4 의 `NPAY - 202603127 - 1777286395026` 같은 transaction_id 는 imweb GTM 코드(또는 NPay 결제 후 콜백) 가 만들어낸 합성 문자열이다. NPay 측이 부여한 실제 주문번호도 아니고, Imweb 측 order_no 도 아니다. 따라서 GA4 raw event 어디에도 실제 주문번호가 들어 있지 않다.

### Robust guard 가 36/36 absent 인 의미

Imweb order_no 18개 + NPay channel_order_no 18개 = 36개를 GA4 raw event 전체(`event_params` 모든 키 포함)에 substring 으로 검색해도 매칭 0건이다. 자세히는 [[coffee-npay-unassigned-ga4-guard-20260501]]. 이건 GA4 export 가 빠졌다는 뜻이 아니라 **실제 주문번호가 GA4 event 안에 어떤 형태로도 들어가지 않는다** 는 뜻이다.

### 그래서 매칭이 약하다

deterministic key 가 부재하므로 GA4 event 와 Imweb actual order 를 잇는 방법은 다음 휴리스틱뿐이다.

1. 결제 시각 근접도 (time gap)
2. 금액 일치 (`final_exact`, `shipping_reconciled` 등)
3. 상품명 overlap

이 휴리스틱이 약한 47건이 unassigned actual 18건 + ambiguous 29건이고, 분류 결과는 `expected_synthetic_gap` 27 / `stop_historical_recovery` 9 / `manual_review_only` 5 / `needs_naver_api_crosscheck` 6 이다.

### 네이버 API 가 와도 이 한계는 그대로다

네이버 주문관리 API 는 NPay 측 actual order 정보(주문번호, 상품, 금액, 정산, 환불 일자)를 직접 준다. 그러나 GA4 에 들어 있는 `NPAY - 202603127 - 1777286395026` 같은 합성 키와 NPay actual order_id 사이의 **mapping 테이블이 어디에도 없다**. 두 시스템이 서로의 식별자를 모른다.

따라서 네이버 API 가 와도 휴리스틱 매칭의 정확도가 약간 올라가는 정도이지, 합성 키 한계가 사라지지 않는다. `needs_naver_api_crosscheck` 6건만 직접 효용이 있다. ≈ 13%.

### 미래분 intent beacon 이 본질 해법인 이유

미래분은 사이트 자체에서 NPay 버튼 클릭 시점에 deterministic `intent_uuid` 를 발급해 GA4 event 와 confirmed order 양쪽에 같은 키를 박을 수 있다. 자세히는 [[coffee-npay-intent-beacon-preview-design-20260501]]. 즉 GA4 synthetic 의존을 끊고 우리가 만든 키로 매칭한다.

요약: **과거분은 합성 키 때문에 자동 매칭이 약한 상태로 close 한다. 미래분은 intent beacon 으로 deterministic key 를 새로 박아서 닫는다. 네이버 API 는 둘 어느 쪽의 핵심 차단 사유도 아니다.**

## 네이버 주문관리 API 필요성 판단

### 결론

현재 단계에서는 PASS. 단, "아임웹 입점 가맹점도 발급 가능한가" 는 메일 1통으로 확인해 두면 좋다.

### 발급 상황

| 단계 | 상태 |
|---|---|
| Sandbox 애플리케이션 | **발급 완료** (2026-05 시점). 키 4종 변수 present at `.env` 256~260 행 (`npay_coffee_store_id`, `npay_coffee_clientid`, `npay_coffee_clientsecret`, `npay_coffee_chainid`). 실제 값은 문서/커밋/메모리에 기록하지 않는다 |
| Sandbox API 연동 | 미진행 |
| Sandbox 검수 요청 | 미진행 |
| Production 발급 | 미진행 |
| 호스팅사 입점 가맹점 가능 여부 | 미확인 — 가이드에 "제휴 호스팅사 입점 주문형 가맹점은 연동 불가" 명시되어 있어 발급 자체가 거절될 가능성 큼 |

### 직접 효용 추정

| 라벨 | 건수 | 네이버 API 효용 |
|---|---:|---|
| `expected_synthetic_gap` | 27 | 0 — synthetic key 한계라 어차피 못 닫음 |
| `needs_naver_api_crosscheck` | **6** | **있음** |
| `stop_historical_recovery` | 9 | 0 — 데이터 자체가 약함 |
| `manual_review_only` | 5 | 0 — 같은 GA4 후보를 더 강한 주문이 가져감 |

→ 네이버 API 가 실제로 닫아 줄 수 있는 건 **6건 / 47건 ≈ 13%**.

### 아임웹 API 가 이미 커버하는 것

| 필요 데이터 | 아임웹 API |
|---|---|
| NPay actual order 60건 / 2,462,300원 | ✅ `type=npay` |
| `channel_order_no` 60/60 | ✅ |
| 결제 후 환불 318건 (paid_then_fully_refunded) | ✅ payments 엑셀 + `결제`/`환불` row, [[coffee-excel-payment-mismatch-2025-20260501]] |
| 결제대기/입금전 취소/결제기한초과 79건 | ✅ payments xlsx `결제상태` |
| GA4 raw event guard | ✅ BigQuery, [[coffee-npay-unassigned-ga4-guard-20260501]] |
| 정산 amount / 수수료 / 환불 일자 정밀도 | ❌ 네이버 API 영역 — 단, 현재 ROAS 정합성 단계에는 불요 |

### 호스팅사 입점 제약

네이버 가이드 명시:

> 제휴 호스팅사 통해 입점한 주문형 가맹점, 예약 가맹점은 주문관리/정산 API 연동이 불가합니다.

더클린커피는 아임웹 입점이므로 발급 시도 끝에 거절될 수도 있다. Sandbox 까지는 이미 받았으니 검수와 Production 발급 시 막힐 가능성이 높다.

### 권장 행동

| 순서 | 행동 | 비용 | 산출물 |
|---|---|---|---|
| 1 | TJ 가 `dl_techsupport@navercorp.com` 에 "아임웹 입점 가맹점도 주문관리/정산 API Production 발급 가능 여부" 메일 1통 | 5분 | 가능 / 불가 공식 답변 |
| 2-A | 답이 "불가" → naver/npay-api-mcp-review 문서에 영구 종결 표기. future intent beacon 트랙으로 100% 전환 | 0 | 트랙 종결 |
| 2-B | 답이 "가능" → Sandbox API 연동을 needs_naver_api_crosscheck 6건 cross-check 용으로만 시도. Production 검수는 future intent 결과 본 뒤 결정 | Sandbox 연동 0.5~1일 | 6건 cross-check 결과 |

지금 Codex 가 추가 작업을 시작하기 전에 1번 메일 답이 먼저다. Sandbox 키는 이미 .env 에 있으므로 답이 "가능" 이면 바로 연동 단계로 들어갈 수 있고, "불가" 면 과거분 매칭 트랙은 close 하고 future intent 로 100% 전환한다.

### 우선순위 결정

지금 차단되어 있는 건 네이버 API 가 아니라 GA4 NPay synthetic transaction_id 자체다. 따라서 네이버 API 발급/연동을 기다리지 말고 future intent beacon (Phase3-Sprint6) 과 ROAS read-only 비교 (Phase3-Sprint7) 를 진행하는 것이 정합도 측면에서 더 빠르다.

## Phase-Sprint 요약표

| Phase | Sprint | 이름 | 담당 | 상태(우리/운영) | 상세 |
|---|---|---|---|---|---|
| Phase0 | [[#Phase0-Sprint1]] | 프로젝트 판단과 안전선 | Codex | 100% / 0% | [[#Phase0-Sprint1]] |
| Phase1 | [[#Phase1-Sprint2]] | Source freshness 기준선 | Codex | 95% / 0% | [[#Phase1-Sprint2]] |
| Phase1 | [[#Phase1-Sprint3]] | 2025 엑셀 원장화 검토 | Codex + TJ | 75% / 0% | [[#Phase1-Sprint3]] |
| Phase2 | [[#Phase2-Sprint4]] | GA4 BigQuery와 주문 원장 대조 | Codex | 85% / 0% | [[#Phase2-Sprint4]] |
| Phase2 | [[#Phase2-Sprint5]] | Coffee NPay 실제 주문 매칭 | Codex + TJ | 95% / 0% | [[#Phase2-Sprint5]] |
| Phase3 | [[#Phase3-Sprint6]] | Coffee NPay intent 장부 | Codex | 50% / 0% | [[#Phase3-Sprint6]] |
| Phase3 | [[#Phase3-Sprint7]] | Meta/TikTok/ROAS 정합성 | Codex + TJ | 35% / 0% | [[#Phase3-Sprint7]] |
| Phase4 | [[#Phase4-Sprint8]] | 공통 Growth Data Harness 편입 | Codex + Claude | 95% / 0% | [[#Phase4-Sprint8]] |

상태 해석:

- `우리`: 문서, 코드 초안, read-only 분석 준비도.
- `운영`: 실제 운영 반영, 정기 실행, 대시보드/알림 적용도.
- 이 문서는 운영 변경이 아니라 검토/설계 문서이므로 운영 상태는 의도적으로 0%에서 시작한다.

개발 순서 점검:

현재 Phase-Sprint 순서는 개발 진행 순서와 맞다.

1. Phase0은 운영 변경 금지선과 프로젝트 판단을 먼저 닫는다.
2. Phase1은 source freshness와 엑셀 원장 후보를 고정한다.
3. Phase2는 GA4/주문 원장 대조와 NPay 실제 주문 매칭을 read-only로 닫는다.
4. Phase3은 read-only 근거가 충분할 때 intent 장부와 ROAS 정합성으로 넘어간다.
5. Phase4는 앞선 패턴을 공통 harness로 재사용하는 단계다.

따라서 순서를 바꾸지 않는다. 2026-05-01 14:40 KST에는 Phase2-Sprint5의 원인 분해와 guard 결과를 고도화했고, 2026-05-01 15:23 KST에는 Phase4-Sprint8의 coffee 전용 하네스 v0를 추가했다.

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

표준 파일 위치는 [[!data_inventory]]를 기준으로 둔다.

| 파일 | 종류 | 데이터 행 | 고유 주문 | 기간 | 상태 |
|---|---|---:|---:|---|---|
| `data/coffee/coffee_orders_2025.xlsx` | 주문내역 | 16,454 | 11,018 | 2025-01-01 ~ 2025-12-31 | 사용 가능 |
| `data/coffee/coffee_payments_2025.xlsx` | 결제내역 | 11,341 | 11,018 | 2025-01-01 ~ 2026-01-01 | 사용 가능 |
| `data/coffee/coffee_orders_2024.xlsx` | 주문내역 | 2,800 | 1,987 | 2024-11-01 ~ 2024-12-31 | 사용 가능 |
| `data/coffee/coffee_payments_2024.xlsx` | 결제내역 | 2,044 | 1,987 | 2024-11-01 ~ 2024-12-31 | 사용 가능 |
| `data/coffee/coffee_orders_2023.xlsx` | 주문내역 | 0 | 0 | 없음 | 헤더-only |
| `data/coffee/coffee_payments_2023.xlsx` | 결제내역 | 0 | 0 | 없음 | 헤더-only |

`data/iamweb_excel_backfill_review.md` 기준 더클린커피 2025 주문 엑셀은 아래 가치를 가진다.

| 항목 | 값 |
|---|---:|
| 파일 | `data/coffee/coffee_orders_2025.xlsx` |
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
| one-to-one assigned | 42건 | 중복 배정 없이 주문-이벤트를 1:1로 묶은 수 |
| one-to-one unassigned actual | 18건, 641,300원 | 실제 NPay 주문이지만 1:1 GA4 이벤트로 안정 배정되지 않은 수 |
| one-to-one unassigned GA4 | 16건, 608,900원 | GA4 NPay형 이벤트지만 1:1 실제 주문으로 안정 배정되지 않은 수 |
| unassigned actual order/channel id guard | 36/36 `robust_absent` | 남은 18건의 Imweb `order_no`와 NPay `channel_order_no`는 GA4 raw에 직접 존재하지 않음 |
| `tb_iamweb_users` coffee order match | 0건 | coffee primary로 쓰면 안 됨 |

판단:

1. 더클린커피 NPay actual order primary는 현재 `Imweb v2 API /v2/shop/orders?type=npay`로 둔다.
2. Naver Commerce API는 공식 주문관리/정산 cross-check와 장기 자동화용이다. 권한 확보 전에도 read-only 정합성 작업은 진행 가능하다.
3. 기존 Python `reconcile-coffee-ga4-naverpay.py`는 dependency와 Naver API scope 전제가 있어 우선순위를 낮춘다. 동일 목적은 TypeScript read-only 스크립트로 대체한다.
4. 과거 GA4 NPay형 transaction_id는 `NPAY - ...` synthetic 값이라 Imweb `order_no` 또는 NPay `channel_order_no`와 exact match되지 않는다. 남은 18건의 `order_no/channel_order_no` 36개도 GA4 raw에서 0건이다.
5. 따라서 과거 주문의 자동 복구 전송은 금지하고, 미래 데이터는 coffee intent 장부로 분리 수집하는 방향이 더 안전하다.

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
4. 2025 결제내역 엑셀과 2024 주문/결제 엑셀은 `data/coffee/` 안에 이미 있음을 확인했다.
5. 데이터 위치 기준판은 [[!data_inventory]]로 분리했다.

100%까지 남은 것:

| 남은 일 | 왜 필요한가 | 어떻게 할 것인가 | 완료 기준 |
|---|---|---|---|
| 2024/2025 통합 import dry-run 리포트 고정 | 엑셀은 확보됐지만 실제 분석 원장으로 쓰기 전 주문/결제 join, 결제금액 mismatch, 환불/취소 상태를 해석해야 한다 | `coffee-excel-import-dry-run.ts` 결과를 연도별 + 통합 리포트로 남긴다 | 2024/2025 주문·결제 join 수, mismatch 수, 결제수단별 금액이 문서화 |
| amount mismatch reason 분해 | 2025 397건, 2024 82건 mismatch를 방치하면 LTV/ROAS 금액 판단이 흔들린다 | 배송비, 할인, 포인트, 수량, 취소/환불, 다품목 장바구니로 reason을 나눈다 | mismatch 상위 reason과 미분류 잔여 건수가 나온다 |
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
상태: 우리 95% / 운영 0%

목표:

더클린커피 NPay 버튼 클릭/GA4 purchase/실제 NPay 주문을 분리한다.

쉬운 설명:

- `GA4 NPay형 58건`은 GA4에 purchase 이벤트로 들어왔고 transaction_id가 `NPAY - ...`처럼 보이는 기록이다. 하지만 이것만으로는 실제 네이버페이 결제완료 주문인지, 버튼/스크립트가 만든 구매 이벤트인지 확정할 수 없다.
- `Imweb NPay actual 60건`은 아임웹 API에서 결제수단이 NPay로 확인된 실제 주문 원장이다. 현재 더클린커피에서는 이 값을 NPay 실제 주문 primary로 둔다.
- 이 Sprint는 두 장부를 주문별로 맞춰서 `GA4에 이미 잡힌 주문`, `GA4에 없는 주문`, `후보가 여러 개라 위험한 주문`을 분리하는 작업이다. 그래야 나중에 GA4/Meta/TikTok 복구 전송을 열더라도 중복 전송과 오탐을 막을 수 있다.

역할 구분:

- TJ: 네이버 판매자/API 권한처럼 외부 계정 확인이 필요한 작업만 담당한다.
- Codex: Imweb API, GA4 BigQuery, PlayAuto, 운영 DB를 read-only로 대조하고 dry-run 리포트를 만든다.
- Claude Code: 현재 해당 없음. 추후 운영자 화면이나 시각화가 필요하면 별도 Sprint로 분리한다.

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
11. 전역 one-to-one 배정을 추가해 GA4 event 중복 배정을 막았다. 결과는 assigned 42건, unassigned actual 18건, unassigned GA4 16건이다.
12. `coffee-ga4-robust-guard.ts`를 추가해 `order_no`와 `channel_order_no`가 GA4 raw 전체에 존재하는지 read-only로 확인할 수 있게 했다.
13. 표준 dry-run row schema를 [[coffee-dry-run-schema]]에 고정했다.
14. `coffee-imweb-operational-readonly.ts`에 unassigned actual/GA4 원인 분류를 추가했다. 결과는 [[coffee-imweb-operational-readonly-20260501]]에 반영했다.
15. one-to-one residual을 추가했다. assigned 42건은 주문 1,821,000원 / GA4 1,750,400원 / 차이 70,600원이고, unassigned 영역은 actual 641,300원 / GA4 608,900원 / 차이 32,400원이다.
16. unassigned actual 18건의 Imweb `order_no`와 NPay `channel_order_no` 36개를 BigQuery robust guard로 확인했다. 결과는 36/36 `robust_absent`이며 상세는 [[coffee-npay-unassigned-ga4-guard-20260501]]에 남겼다.
17. unassigned actual 18건을 자동 전송 후보가 아니라 4가지 라벨로 분류했다. `expected_synthetic_gap` 8, `stop_historical_recovery` 6, `manual_review_only` 3, `needs_naver_api_crosscheck` 1. 결정 기준은 score, time_gap, amount_match_type, 이미 다른 주문에 GA4 후보가 배정됐는지에 따른다.
18. ambiguous 29건을 `same_window` 안에서 재점수화 가능한지 판단했다. `expected_synthetic_gap` 19, `needs_naver_api_crosscheck` 5, `stop_historical_recovery` 3, `manual_review_only` 2로 분류했고, `can_reduce_without_new_data` 는 29건 모두 N(과거 데이터만으로 자동 축소 불가)으로 표시했다.

2026-05-01 14:40 KST 고도화 결과:

| 항목 | 값 | 해석 |
|---|---:|---|
| one-to-one assigned | 42건 | 현재 보수 기준에서 안정 배정 가능 |
| one-to-one unassigned actual | 18건 | 자동 전송 후보 아님 |
| one-to-one unassigned GA4 | 16건 | 실제 주문 자동 배정 불안정 |
| unassigned actual reason: score below threshold | 13건 | 후보는 있으나 점수 65 미만이라 배정하지 않음 |
| unassigned actual reason: best GA4 already assigned | 5건 | 같은 GA4 후보를 더 강한 주문이 가져감 |
| unassigned actual time gap within 2m | 1건 | 후보가 가까워도 이미 다른 주문에 배정되어 자동 후보 제외 |
| unassigned actual order/channel id robust guard | 36/36 absent | 실제 주문번호/외부 주문번호가 GA4 raw에 직접 남아 있지 않음 |

100%까지 남은 것:

| 남은 일 | 왜 필요한가 | 어떻게 할 것인가 | 완료 기준 |
|---|---|---|---|
| unassigned actual 18건 처리 방침 확정 | 이미 직접 주문번호 guard는 absent지만, 이것을 누락으로 볼지 GA4 synthetic 한계로 볼지 구분해야 한다 | 18건을 `expected_synthetic_gap`(8), `needs_naver_api_crosscheck`(1), `stop_historical_recovery`(6), `manual_review_only`(3)로 분류 완료. `coffee-imweb-operational-readonly.ts` 가 `historicalRecoveryLabel` 필드로 출력 | 자동 전송 금지 + 수동 검토/네이버 API 보완/과거 복구 중단 중 하나로 분리 — **완료** |
| ambiguous 29건 축소 또는 종료 판단 | ambiguous는 전송 금지라 후보가 많으면 과거 복구 자동화가 어렵다 | 동일 금액 반복 주문을 결제시각, 상품명, channel_order_no, page_location 기준으로 재점수화하되, 점수 개선 여지가 낮으면 과거분 복구를 포기하고 미래 intent로 넘긴다 | 29건 재점수: `expected_synthetic_gap` 19 / `needs_naver_api_crosscheck` 5 / `stop_historical_recovery` 3 / `manual_review_only` 2. `can_reduce_without_new_data` 는 29건 모두 N으로 결론 → 새 데이터(naver API 또는 future intent) 없이 자동 축소 불가 — **완료** |
| A/B/ambiguous 기준 운영 승인 | 운영자와 광고 담당자가 같은 기준으로 판단해야 한다 | [[coffee-dry-run-schema]] 기준을 팀 리뷰 후 승인 또는 수정 | `A_strong`, `B_strong`, `ambiguous` 기준 확정 |
| Naver seller/API scope 확인 | Imweb API가 primary여도 네이버 공식 주문관리/정산 cross-check는 장기적으로 유용하다 | TJ님이 네이버 기술지원/호스팅사 경로로 주문형 API 가능 여부 확인 | sample NPay order 1건 read 성공 또는 불가 공식 답변 |
| 향후 intent 장부 설계 | 과거분은 GA4 synthetic transaction_id 때문에 자동 매칭이 약하다 | 미래분은 버튼 클릭 시 `client_id`, `ga_session_id`, product, page를 저장하는 coffee intent 초안을 설계 | live publish 전 preview 계획 완성 |

주의:

coffee NPay는 Imweb API로 actual order 원장을 볼 수 있고, BigQuery 접근도 되므로 `already_in_ga4` guard는 biocom보다 좋다. 다만 과거 GA4 NPay형 transaction_id가 actual order id가 아니라서 주문 단위 자동 복구 전송은 아직 금지다.

## Phase3-Sprint6

이름: Coffee NPay intent 장부  
담당: Codex  
상태: 우리 50% / 운영 0%

목표:

더클린커피도 NPay 버튼이 외부에 노출되어 있으므로, 버튼 클릭과 실제 결제를 분리하는 intent 장부를 준비한다.

완료한 것:

1. biocom에서 `npay_intent_log` 수집, 30초 dedupe, `ga_session_id` 추출, `already_in_ga4` guard 패턴을 검증했다.
2. coffee는 같은 아임웹/NPay 구조일 가능성이 있어 동일 패턴을 재사용할 수 있다.
3. 더클린커피 NPay 버튼 DOM을 정적 HTML로 조사했다. PC `#naverPayWrap` (Naver SDK 가 런타임 렌더), Mobile `._btn_mobile_npay` / `.cart_btn.n_pay`, 공통 진입점 `SITE_SHOP_DETAIL.confirmOrderWithCartItems("npay", url)` 까지 확인했다. imweb_payment 경로 (`'guest_login'`) 와 NPay 경로 (`'npay'`) 는 함수 1번째 인자로 분기된다.
4. preview-only 설계안을 [[coffee-npay-intent-beacon-preview-design-20260501]] 에 작성했다 (v0.2). 핵심 보강:
   - `intent_uuid` 는 결제 시도(`confirm_to_pay`)마다 새로 발급. `session_uuid` 와 `intent_seq` 분리로 한 세션 내 여러 시도 구분.
   - "confirmed order 양쪽에 박는다" 표현 보수화. **Imweb URL Query Param 보존 검증** 후 (A) deterministic 또는 (B) ledger + `(prod_code, quantity, estimated_item_total, order_time_kst ± 30분)` 휴리스틱 트랙 분기.
   - `initDetail` 이 snippet 실행 전에 끝난 경우 fallback 3단 (wrap → inline script regex → DOM data attribute), 못 잡으면 `metadata_missing=true`.
   - payload 에 `selected_quantity`, `estimated_item_total` 추가 (PII 아닌 reconciliation 숫자).
   - 검증 시나리오 5개를 체크리스트 형태로 (PC NPay / Mobile NPay / 일반 구매하기 / 옵션 미선택 / 같은 세션 내 2회 시도 시 intent_uuid 갱신).
   - Live 배포 금지 가드 8종 명시 (GTM publish / imweb head / fetch·sendBeacon·XHR / gtag / Meta CAPI / TikTok Events / backend API / sessionStorage·console 외 사용 금지).
5. 2026-05-01 KST chrome devtools 진단 중 **site 에 이미 `funnel-capi v3` (2026-04-15) 가 first-party `sessionId` + `eid` 시스템 운영 중** 임을 발견했다. console marker `[funnel-capi] installed 2026-04-15-thecleancoffee-funnel-capi-v3 pixel=1186437633687388 enableServerCapi=false sessionId=mompe62dw2gxlk` 와 `inject eid ViewContent ViewContent.1.{sessionId}` 출력이 그 증거. 이는 우리 `session_uuid`/`intent_uuid`/`intent_seq` 와 거의 동일한 패턴이라 새로 박지 말고 재사용/공존해야 한다.
6. 본 발견을 design 폐기가 아니라 **v0.3 보강** 으로 정리했다:
   - design 문서에 funnel-capi compatibility 섹션 추가. 진단 명령 A/B/C 묶음 (site 진입 직후 / preview snippet 실행 후 / NPay 클릭 직후) 정의.
   - 결과 분기 6종 (sessionId 노출됨 → 재사용 / 노출 안 됨 → 별도 발급 + 함께 기록 / NPay eid 박음 → intent_uuid 폐지하고 eid 사용 / NPay eid 안 박음 → 우리 design NPay 보강 layer 유지 / wrap 사라짐 → BUY_BUTTON_HANDLER 직접 wrap fallback / hook 못 잡음 → 동일 fallback) 정의.
   - 공존 원칙 명시: funnel-capi 코드 수정 금지, sessionId/eid 는 읽기만, fbq 재wrap 금지.
7. 본 발견을 재발 방지 차원에서 [[harness/coffee-data/LIVE_TAG_INVENTORY|Coffee Live Tag Inventory template]] 으로 박았다. 새 wrapper / intent / eid 작업 직전 §1~§8 항목을 채워야 한다 (live console markers / GTM live version / imweb header·footer / existing wrappers / existing session·eid keys / server send enabled 상태 / observed events / NPay 분기 이벤트 유무). [[coffee-live-tracking-inventory-20260501]] 가 이 template 의 첫 snapshot.
8. [[harness/coffee-data/AUDITOR_CHECKLIST|Coffee Auditor Checklist]] 에 hard fail 2종 + soft fail 2종 추가:
   - hard fail: tracking 작업인데 LIVE_TAG_INVENTORY snapshot 7일 stale 또는 부재 / 새 wrapper 설계인데 inventory §4 existing wrappers 미확인.
   - soft fail: 새 session·eid 체계 설계인데 inventory §5 미확인 / 새 client wrapper 추가인데 §6 server send enable 상태 미확인.
9. 2026-05-01 KST 1차 진단 (TJ chrome devtools) 결과 [[coffee-live-tracking-inventory-20260501]] §4/§5/§7/§8 채움:
   - funnel-capi 는 **window 변수 노출 없음** (4종 후보 모두 undefined). 단 sessionStorage `funnelCapi::sent::<eid>` 키에서 정규식 추출 가능.
   - fbq 는 funnel-capi 에 의해 wrap 됨. `MIRROR_EVENTS[args[1]]` 매핑 등록 이벤트만 eid 주입.
   - `SITE_SHOP_DETAIL.confirmOrderWithCartItems` 는 **thin wrapper**. 진짜 함수는 글로벌 `window.confirmOrderWithCartItems`.
   - preview snippet wrap 자체는 잡혔으나 (`confirmOrderLooksWrapped: true`) PC NPay click 시 buffer 변화 0건 — hook 미호출 추정.
   - TikTok pixel (`ttq`) `undefined` (사이트 미설치).
   - 미관찰 sessionStorage 키 `__seo_funnel_session` 발견. 정체 미확인.
10. 다음 진단 단계 정의: 진단 E (fbq MIRROR_EVENTS 정규식 추출 + sessionStorage funnel-capi sent 목록 + `__seo_funnel_session` 값) / 진단 F (`SITE_SHOP_DETAIL.confirmOrderWithCartItems` 와 글로벌 `window.confirmOrderWithCartItems` 직접 호출 sanity test) / 진단 G (NPay PC click 직전 console clear → 클릭 → 출력된 console 줄 캡처). 결과 분기 6종 정의해 design v0.4 분기 결정 준비.
11. **2026-05-01 KST imweb 헤더/푸터 코드 정본** [[coffee/!imwebcoffee_code_latest_0501]] (총 2,292행) 발견 + 4 layer 직접 분석. 이로써 진단 E 의 핵심 항목 거의 폐기 (정답이 정본 안에 있음):
    - **MIRROR_EVENTS 4종 확정** (line 2125~2131): `ViewContent`, `AddToCart`, `InitiateCheckout`, `AddPaymentInfo`. **Purchase 는 의도적 제외** (Purchase Guard v3 단독 관리).
    - **`__seo_funnel_session` 정체 확정** (line 2102~2112): funnel-capi 가 자체 발급한 sessionId 의 sessionStorage 키. 형식 `Date.now().toString(36) + Math.random().toString(36).slice(2, 8)`. window 변수 비노출.
    - **eid 형식 확정** (line 2147): `<EventName>.<contentKey>.<sessionId>`. `contentKey` = `content_ids[0]` 또는 `v<value>`.
    - **window 노출 변수 확정**: `window.__FUNNEL_CAPI_INSTALLED` (= SNIPPET_VERSION), `window.FUNNEL_CAPI_CONFIG`. 진단 A 후보에 빠져 있어서 false 나옴.
    - **server CAPI endpoint** = `https://att.ainativeos.net/api/meta/capi/track` (현재 disabled). **Purchase Guard decision endpoint** = `https://att.ainativeos.net/api/attribution/payment-decision`.
    - **4 layer 구조**: Purchase Guard v3 (line 12~946) / 보조 헤더·바디 (947~994) / checkout-started v1 (1185~1561) / payment-success-order-code v1 (1563~2041) / funnel-capi v3 (2042~2292).
    - design v0.4 결정: `session_uuid` 발급 helper 는 `__seo_funnel_session` 우선, 없으면 fallback. `intent_uuid` 는 별도 발급 (funnel-capi eid 는 결제 시도 단위 unique 키 아님). 글로벌 `window.confirmOrderWithCartItems` 도 동시 wrap. Purchase 는 본 design 매핑 대상 아님 (Purchase Guard 단독). NPay 분기에서 funnel-capi 가 안 채우는 영역만 보강.
    - TJ 진단 작업 변경: **진단 E 폐기 (1줄로 축소), 진단 F/G 그대로 유지**, 새 작업 (imweb 4 layer NPay 분기 분석) 은 정본 코드 read-only 분석으로 별도 phase 진행.
13. **2026-05-01 21:57 KST 진단 G v0.4 snippet 결과 — PC NPay click hook 정상 도달 + funnel-capi InitiateCheckout eid 박음**:
    - `bufferDelta: 1`, `intentSeqDelta: 1`, `lastPayload.intent_phase: "confirm_to_pay"` + `is_simulation: false` → wrap 정상.
    - `lastPayload.session_uuid: "momuyeuikmcmug"` = `funnel_capi_session_id` 일치 → `__seo_funnel_session` 재사용 정책 검증.
    - `intent_uuid: "28b457f7-..."` (UUID), `intent_seq: 1` → confirm_to_pay 단위 새 발급 정책 검증.
    - `metadata_source: "inline_script_regex"` → 3-step fallback (initDetail wrap → inline regex → DOM) 정상. prod_code `s20190901240a23893fa08` / prod_price 21,900원 / quantity 1 / `metadata_missing: false`.
    - `newFunnelCapiSentEids: ["funnelCapi::sent::InitiateCheckout.o20260501dc2f080566c61.f0eb2"]` 1건 추가. **4 layer 분석의 가설 "NPay 외부 redirect 라 funnel-capi 추가 marker 0 예상" 반증** — NPay click 시점에 imweb 이 자체 fbq InitiateCheckout 발화 → funnel-capi mirror 작동. content_ids[0] 가 `.` 포함 단일 값 (orderCode-like prefix).
    - design v0.4 의 4가지 결정 (sessionId 재사용 / intent_uuid 별도 발급 / 글로벌 함수 동시 wrap / Purchase 매핑 대상 아님) 모두 검증.
    - **우리 wrap 의 가치 좁혀짐**: (i) NPay click 자체 deterministic key (`intent_uuid`), (ii) 비어 있는 backend `checkout-started v1` attribution layer 보강 — 두 영역. NPay 도 fbq InitiateCheckout 단계는 살아 있음 (4 layer 분석 정정).
    - 다음 단계: Imweb URL Query Param 보존 검증 (sandbox 결제 1건으로 `intent_uuid` 가 redirect URL / Imweb meta_data / NPay channel_order_no 응답 중 어디까지 보존되는지). 결과로 (A) deterministic 트랙 또는 (B) ledger 트랙 분기 결정.
15. **2026-05-01 22:30 KST snippet v0.5 (A++) 트랙 PASS 검증 완료** ([[coffee-npay-intent-beacon-preview-snippet-v04-20260501]] § v0.5 / [[coffee-npay-intent-uuid-preservation-test-20260501]] § v0.5 검증 결과):
    - PC NPay click 1회 (shop_view/?idx=73, 19,900원) → snippet v0.4 + v0.5 보강 정상 작동
    - **`imweb_order_code: o2026050189a174746502e`** (`o<YYYYMMDD><14자 hex>`) 1500ms retry 시점에 capture
    - `imweb_order_code_eid: InitiateCheckout.o2026050189a174746502e.63911`, intent_uuid + funnel_capi_session_id + funnel_capi_eid_observed 모두 정상
    - (A++) 트랙 작동 확정 — 다음 phase 의 backend ledger `coffee_npay_intent_log` 작성 + `imweb_orders.order_code` 와 1:1 deterministic join 진입 가능
    - **추가 발견 — GA4 dataLayer NPay synthetic transaction_id 형식**: `NPAY - <imweb 자체 ID 9자리> - <Date.now() ms>` (예 `NPAY - 202604101 - 1777642253241`). [[coffee-imweb-operational-readonly-20260501]] 의 unassigned actual recovery 분석에서 robust_absent 36/36 의 진짜 매칭 키가 이 transaction_id. 우리 ledger 에 capture 하면 GA4 BigQuery `transaction_id` 와 1:1 매핑 가능 (synthetic id 가 imweb 어디 sessionStorage/DOM/window 에 박히는지 v0.6 추가 정찰)
    - 확보된 deterministic key 5종: (i) intent_uuid 우리 발급, (ii) funnel_capi_session_id, (iii) imweb_order_code → backend, (iv) GA4 NPay synthetic transaction_id → BigQuery, (v) NPay 측 orderID → NPay seller API
    - cross-site 적용 가능성 HIGH — biocom 도 같은 imweb funnel-capi v3 인프라이면 동일 형식 가정. site 식별자만 치환해 적용. [[coffee-funnel-capi-cross-site-applicability-20260501]] 에 반영
16. **2026-05-01 23:00 KST backend NPay intent ledger (dry-run only) 추가**:
    - `backend/src/coffeeNpayIntentLog.ts` 신규 — schema (`coffee_npay_intent_log` 테이블 + 4종 인덱스) + payload validation (PII 차단, required 필드, intent_phase enum, raw_json size limit 16KB) + dry-run runner.
    - `backend/src/routes/coffee.ts` 에 `POST /api/coffee/intent/dry-run` + `GET /api/coffee/intent/stats` 엔드포인트 추가.
    - schema CREATE TABLE IF NOT EXISTS 만 backend 부팅 시 ensure. dry-run 응답에 ledger row preview 만 돌려주고 INSERT 안 함. enforce mode 는 별도 phase 에서 활성.
    - 가드: PII 키 (phone/email/name/address/option 원문) payload 안 발견 시 reject. external API 호출 / GA4 / Meta / TikTok / Google Ads 송출 0건. snippet 자체는 fetch 금지라 본 endpoint 는 GTM Preview 또는 별도 dispatcher 통해서만 호출.
    - tsc PASS. backend 수동 재시작 시점에 schema 생성 + endpoint 활성. 현재 7020 운영 중인 backend 는 미반영 (TJ 재시작 결정).
17.5. **2026-05-01 23:35 KST backend 7020 재시작 + endpoint 활성 + dry-run 검증 4종 PASS**:
    - production server (PID 9548 → 99378) graceful restart. dist 재빌드 후 launchd → 새 process. 다운타임 ~3초
    - schema_ensured: true (`coffee_npay_intent_log` 테이블 + 5종 인덱스 자동 생성. backend SELECT 로 확인됨)
    - dry-run endpoint 4종 시나리오 PASS: (1) valid payload (TJ v0.5 검증 결과 기반) → ok=true, ledger_row_preview 정상 생성, imweb_order_code 매핑 가능성 YES 표기 (2) PII (`orderer_name`) 포함 → ok=false, pii_fields_found 정확 표시 (3) required 필드 누락 → ok=false, errors 3종 표시 (4) 잘못된 site (`biocom`) → ok=false, site enum error
    - INSERT 0 확인 (총 row 0 유지)
19. **2026-05-01 23:55 KST all-in-one snippet (A++) 트랙 최종 PASS — GA4 synthetic id 미캡처 원인 가설 3종**:
    - PC NPay click 1회 (shop_view/?idx=73, 19,900원) → buffer +1, intent_phase `confirm_to_pay`, `imweb_order_code: o20260501f484f95a0da7e` (1500ms retry), session/intent UUID 모두 정상
    - **`ga4_synthetic_transaction_id: undefined`** — v0.6 retry 가 dataLayer 에서 NPay synthetic id 못 잡음. 가설: (a) imweb 의 console 출력이 dataLayer push 가 아니라 디버그 log, (b) push 시점이 retry 윈도우 바깥, (c) dataLayer 의 다른 키 위치
    - 결론: **(A++) 만으로 deterministic 매핑 가능**. backend ledger ↔ `imweb_orders.order_code` 1:1 join 충분. GA4 synthetic id 는 nice-to-have, enforce mode 진입 blocker 아님
    - 다음 단계 후보: (i) enforce mode 활성 + dispatcher (HIGH), (ii) v0.7 정찰 dataLayer dump (LOW, optional)
18. **2026-05-01 23:40 KST snippet all-in-one 통합본 작성**:
    - [[coffee-npay-intent-beacon-preview-snippet-all-in-one-20260501]] 신규 — v0.4 + v0.5 + v0.6 한 묶음 IIFE. paste 1번으로 wrap + retry capture 두 채널 모두 install
    - 이전 분리본 ([[coffee-npay-intent-beacon-preview-snippet-v04-20260501]]) 도 reference 용으로 보존
    - 검증 절차 4 step (status / simulate / 실제 NPay click / final_check) 포함
17. **2026-05-01 23:10 KST snippet v0.6 보강 — GA4 NPay synthetic transaction_id capture 추가**:
    - v0.5 보강 위에 1회 install 하는 IIFE. confirm_to_pay 직후 setTimeout 100/500/1500/3000ms 4회 retry 로 `window.dataLayer` 안 transaction_id 후보 검사 → `^NPAY\s*-\s*\d+\s*-\s*\d{10,}$` 패턴 매칭 → buffer last entry 에 `ga4_synthetic_transaction_id` 필드 + source / dl_event / capture_delay_ms 메타 추가.
    - 검사 위치: `dataLayer[i].transaction_id`, `dataLayer[i].ecommerce.transaction_id`, `dataLayer[i].ecommerce.transactionId`, `dataLayer[i].ecommerce.purchase.actionField.id`.
    - 가드: dataLayer read 만, push 가로채지 않음. fetch/sendBeacon/XHR/gtag/fbq/backend API 호출 0. funnel-capi / GTM / GA4 동작 변경 0.
    - 검증 명령 + 기대 결과 분기 표 포함. capture 안 되면 결제 완료 페이지에서만 push 되는 케이스 가설 → v0.7 에서 결제 완료 페이지용 별도 capture.
    - TJ 검증 1회 (PC NPay click → buffer 의 ga4_synthetic_transaction_id 채워지는지) 으로 (A++) + GA4 deterministic 두 채널 확정 가능.
18. **imweb 4 layer NPay tracking flow 분석 완료** ([[coffee-imweb-tracking-flow-analysis-20260501]]):
    - 4 layer 의 trigger 조건 / 발화 이벤트 / 시간 순서 / fbq wrap 중첩 순서 (funnel-capi → Purchase Guard → 원본) 정본 코드 인용으로 정리.
    - **결정적 발견: NPay 결제 흐름은 일반 PG 결제와 달리 `checkout-started v1` 단계가 의도적으로 비어 있다** (NPay 외부 도메인 redirect 때문). `isCheckoutCandidate()` 가 `shop_payment_complete|shop_order_done` 미매치 + `shop_order|shop_payment|order_form|checkout` 매치 조건이라 NPay 외부 결제 페이지에서는 imweb 코드 실행 0.
    - **NPay click 자체 추적도 4 layer 어느 것도 안 함**. Purchase Guard 는 결제 완료 페이지에서만, checkout-started 는 imweb 결제 진입 페이지에서만, payment-success 는 결제 완료 페이지에서만 활성.
    - **우리 NPay intent beacon 의 진짜 가치 정당화**: (a) NPay click 자체 추적, (b) click 시점 deterministic key 발급, (c) 비어 있는 checkout-started 단계 attribution context 보강 — 세 영역.
    - design v0.4 결정 (글로벌 함수 동시 wrap / `__seo_funnel_session` 재사용 / `intent_uuid` 별도 발급 유지 / Purchase 매핑 대상 아님) 이 정본 코드 line 인용으로 정당화.
    - 일반 PG vs NPay 차이 표, fbq wrap 중첩 순서, NPay 결제 timeline 9단계 모두 분석 문서에 박음.
    - 진단 우선순위 재조정: 진단 F (HIGH, wrap 정상/우회 분리) / 진단 G (MID, 단 NPay 외부 redirect 로 추가 marker 0 예상) / 신규 진단 (sandbox 결제 1건으로 url query param 보존 검증, 별도 phase).

100%까지 남은 것:

| 남은 일 | 왜 필요한가 | 어떻게 할 것인가 | 완료 기준 |
|---|---|---|---|
| coffee 버튼 DOM 조사 | selector가 biocom과 다를 수 있다 | Playwright/curl/브라우저로 NPay button DOM과 href/form 구조 확인 | 안정 selector 1개 이상 — **완료**, [[coffee-npay-intent-beacon-preview-design-20260501]] |
| site 분리 저장 | biocom intent와 섞이면 ROAS가 망가진다 | `site='thecleancoffee'`, domain, page_location, product_idx 저장 | site filter로 분리 조회 가능 — payload schema 확정, 저장은 Step 4 별도 phase |
| GTM/스크립트 배포 전 preview | live publish 전 compiler와 network를 확인해야 한다 | GTM preview 또는 site custom script preview | 1회 click -> 1 intent 저장 — preview snippet 초안 + 시나리오 5개 작성 완료, 실제 chrome devtools 실행은 다음 단계 |
| no-purchase 분리 | 버튼 클릭만 한 사람을 purchase로 보면 안 된다 | 24시간 grace 후 confirmed order 없는 intent를 `clicked_no_purchase`로 분리 | 상품별 미결제 리포트 생성 — local store(Step 4) 후 진행 |

이 단계는 바로 운영 배포하지 않는다. 먼저 coffee GA4 BigQuery와 actual order 구조를 read-only로 닫은 뒤 진행한다.

## Phase3-Sprint7

이름: Meta/TikTok/ROAS 정합성  
담당: Codex + TJ  
상태: 우리 35% / 운영 0%

목표:

더클린커피 광고비, GA4, 실제 주문, NPay 미복귀 문제를 같은 window에서 비교한다.

완료한 것:

1. 과거 문서에서 coffee Meta API token 만료 가능성을 확인했다.
2. `SITE_ACCOUNTS`에 더클린커피 Meta account mapping은 존재한다.
3. BigQuery가 열려 있으므로 GA4 측 raw purchase guard는 좋다.
4. Meta `act_654671961007474` 와 TikTok `7593201373714595856` 의 token freshness 와 last_7d insights 응답이 정상임을 확인했다. 결과는 [[coffee-source-freshness-meta-tiktok-20260501]] 에 정리했다. Meta last_7d (2026-04-24~30) spend 344,728원 / impressions 11,801 / clicks 300. TikTok advertiser 단위 spend 3,580,556원 (BIOCOM + COFFEE 합산이며, coffee 분리는 campaign/adgroup 단위로 가야 함).

100%까지 남은 것:

| 남은 일 | 왜 필요한가 | 어떻게 할 것인가 | 완료 기준 |
|---|---|---|---|
| Meta token freshness 확인 | token 만료 상태면 spend/ROAS 비교가 무의미하다 | coffee account `act_654671961007474` API 호출 | 최근 7일 spend 조회 성공 — **완료**, [[coffee-source-freshness-meta-tiktok-20260501]] |
| TikTok 식별값 확인 | NPay 복구를 TikTok까지 확장하려면 `ttclid`, `_ttp`가 필요하다 | GTM/landing cookie/event_params 확인 | TikTok attribution key presence 표 |
| TikTok coffee campaign 분리 | advertiser `7593201373714595856` 가 BIOCOM + COFFEE 합산이므로 coffee 단독 spend 산출이 따로 필요하다 | `tiktok-business-report-dry-run.ts` campaign daily breakdown 으로 coffee site 매핑 | coffee campaign 단위 spend / 7d 산출 |
| 광고비 window 고정 | 주문 window와 광고 window가 다르면 ROAS 오판 | KST 날짜 기준 7일/14일 고정 | spend, click, purchase, revenue 같은 window |
| 전환 전송 승인선 | 광고 플랫폼에 잘못 보내면 학습이 망가진다 | GA4 -> Meta -> TikTok -> Google Ads 순으로 제한 테스트 | 각 플랫폼별 approval gate 문서 |

## Phase4-Sprint8

이름: 공통 Growth Data Harness 편입  
담당: Codex + Claude  
상태: 우리 88% / 운영 0%

목표:

biocom NPay에서 만든 harness 개념을 coffee에도 적용한다.

완료한 것:

1. biocom에는 `read-only phase`, `dispatcher dry-run`, `BigQuery guard`, `manual_test_order exclusion`, `A/B/ambiguous`, `human approval` 루프가 생겼다.
2. coffee는 BigQuery 접근 가능하므로 harness의 guard 부분을 더 깔끔하게 검증할 수 있다.
3. NPay recovery `VERIFY.md`에 false positive가 많은 `rg` 검사 보완을 추가했다. 문서 언급과 실행 가능한 새 전송 경로를 분리해서 보고한다.
4. `shipping_reconciled`는 dry-run classification에 쓰되, 실제 limited send 후보로 쓸 때는 7일 후보정 또는 TJ 승인안에서 별도 확인하도록 `RULES.md`와 `APPROVAL_GATES.md`에 명시했다.
5. 하네스 완료 보고에 Auditor verdict 형식을 고정했다.
6. 더클린커피 전용 하네스 v0를 `harness/coffee-data/`에 만들었다.
7. [[harness/coffee-data/CONTEXT_PACK|Coffee Context Pack]]에 source/window/freshness, 최신 숫자, 데이터 위치, 표준 명령을 고정했다.
8. [[harness/coffee-data/RULES|Coffee Rules]]에 BigQuery-first, Imweb NPay actual, Excel dry-run, amount match, BigQuery guard 규칙을 분리했다.
9. [[harness/coffee-data/AUDITOR_CHECKLIST|Coffee Auditor Checklist]]와 [[harness/coffee-data/VERIFY|Coffee Verify]]에 coffee 전용 no-send/no-write/no-deploy 검증을 추가했다.
10. [[harness/coffee-data/EVAL_LOG_SCHEMA|Coffee Eval Log Schema]]에 NPay matching row, Excel dry-run row, ROAS read-only schema를 고정했다.
11. [[harness/coffee-data/LESSONS|Coffee Lessons]]에 synthetic NPay transaction_id, Imweb `type=npay`, robust_absent, 2023 header-only 같은 관찰을 candidate_rule로 남겼다.
12. `scripts/coffee_harness_audit.py`를 추가해 wiki link, diff check, executable no-send/no-write pattern, unrelated staged file 검사를 한 번에 볼 수 있게 했다.
13. [[harness/coffee-data/LIVE_TAG_INVENTORY|Coffee Live Tag Inventory template]] 추가 (2026-05-01 funnel-capi 발견 사고 재발 방지 차원). 새 wrapper/intent/eid 작업 직전 §1~§8 항목을 채워야 하며, snapshot 7일 stale 또는 부재 시 [[harness/coffee-data/AUDITOR_CHECKLIST|AUDITOR_CHECKLIST]] hard fail. AUDITOR_CHECKLIST 에 hard fail 2종 + soft fail 2종 추가.

100%까지 남은 것:

| 남은 일 | 왜 필요한가 | 어떻게 할 것인가 | 완료 기준 |
|---|---|---|---|
| coffee 하네스 반복 적용 | 문서만 만들면 실제 작업 품질이 좋아졌는지 알 수 없다 | 다음 Phase2/Phase3 작업에서 `harness/coffee-data/README.md`부터 읽고 VERIFY/Auditor verdict를 붙인다 | 2회 이상 PASS_WITH_NOTES 기록 |
| coffee lessons-to-rules 승인 | biocom에서 배운 규칙을 coffee와 AIBIO에 재사용해야 한다 | [[harness/coffee-data/LESSONS|Coffee Lessons]]의 candidate_rule을 2회 이상 반복 확인 후 approved_rule로 승격한다 | candidate_rule/approved_rule 목록 |
| auditor script v1 고도화 | 현재 helper는 changed file 중심이라 report 숫자 대조는 수동이다 | `scripts/coffee_harness_audit.py`가 `!coffeedata` 숫자와 최신 report 숫자를 자동 대조하게 확장한다 | 숫자 mismatch 자동 감지 — **완료**: 6개 metric (Imweb NPay actual, GA4 NPay pattern, one-to-one assigned/unassigned, recovery labels, LTV combined, 2025 mismatch total) cross-check. 표기 형식 차이는 multi-template + 한국어 단위 변환으로 흡수 |
| Claude/프론트 handoff | Claude Code가 UI/시각화를 맡을 때 같은 기준을 봐야 한다 | coffee harness 요약을 AGENTS 또는 별도 handoff 문서에 연결한다 | Claude가 같은 금지선으로 리뷰 가능 |

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

1. ~~unassigned actual 18건의 처리 방침을 확정한다~~ — **완료**: `expected_synthetic_gap`(8) / `stop_historical_recovery`(6) / `manual_review_only`(3) / `needs_naver_api_crosscheck`(1) 라벨링. [[coffee-imweb-operational-readonly-20260501]] § Unassigned Actual Historical Recovery Label Summary.
2. ~~2025 엑셀 amount mismatch 397건을 결제상태/환불/부분환불/무료결제 reason으로 분해~~ — **완료**: `coffee-excel-payment-mismatch.ts` + [[coffee-excel-payment-mismatch-2025-20260501|2025 분해]] / [[coffee-excel-payment-mismatch-2024-20260501|2024 분해]]. 2025 397건 = `paid_then_fully_refunded` 318 / `payment_deadline_exceeded` 41 / `input_pre_cancel` 35 / `payment_pending` (부분환불) 3. 2024 82건 동일 패턴.
3. ~~2024/2025 엑셀을 같은 dry-run 스크립트로 각각 재실행하고 24개월 LTV aggregate를 비교~~ — **완료**: `coffee-excel-ltv-dry-run.ts` + [[coffee-excel-ltv-dry-run-20260501]]. 통합 12,731건 / 4억 7,669만원, 고객 4,536명, 2024→2025 잔존 59.06%.
4. ~~coffee NPay intent beacon의 preview-only 설계안을 작성~~ — **완료**: [[coffee-npay-intent-beacon-preview-design-20260501]]. function wrap 채택, payload PII 제외 14필드, 시나리오 5개, live publish 금지 가드.
5. ~~Meta/TikTok source freshness 확인 후 ROAS read-only 비교 재개~~ — **완료**: [[coffee-source-freshness-meta-tiktok-20260501]]. Meta token healthy, TikTok token healthy, advertiser 단위 spend (BIOCOM+COFFEE 합산) 확인. coffee 단독 ROAS 비교는 campaign 분리 후 별도 phase.
6. ambiguous 29건은 신규 데이터(naver API 또는 future intent) 없이는 자동 축소 불가 결론. 추가 분류는 보류.
7. coffee_harness_audit.py 가 !coffeedata 핵심 숫자 6개를 최신 report 와 자동 cross-check 하도록 고도화. 현재 모두 PASS.

컨펌 또는 TJ 작업이 필요한 것:

1. 더클린커피 Naver Commerce API 권한 확인.
2. 더클린커피 Meta token 갱신 또는 새 token 공유.
3. 신규 기간 엑셀 다운로드가 필요할 때 [[!data_inventory]]에 먼저 경로/상태를 갱신.
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
