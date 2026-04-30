# 네이버페이 ROAS 정합성 회복 계획

작성 시각: 2026-04-30 12:18 KST
기준일: 2026-04-30
관련 문서: [[!npay|네이버페이 주문형 결제형 전환 검토]], [[npay-intent-quality-20260430|NPay Intent 수집 품질 점검]], [[GA4/gtm|biocom GTM 컨테이너 상태 정리]]
Primary source: VM SQLite `npay_intent_log`, 운영 주문 원장 `operational_postgres.public.tb_iamweb_users`
Cross-check: 보호된 `GET /api/attribution/npay-intents`, GTM API live version `139`
Window: NPay intent는 2026-04-27 18:10 KST 이후, 주문 원장은 dry-run window 기준 `PAYMENT_COMPLETE` NPay 주문
Freshness: VM SQLite snapshot `2026-04-30 17:48 KST`, dry-run report `2026-04-30 18:24 KST`, 분석 window end `2026-04-30 17:48 KST`
Confidence: 89%

## 10초 요약

새 목적은 `네이버페이 버튼을 없앨지`가 아니다. 버튼은 외부 주문형으로 살리되, `버튼만 누르고 결제하지 않은 사람`과 `버튼을 누른 뒤 실제 NPay 결제까지 완료한 사람`을 분리해 GA4, Meta, TikTok ROAS를 바로잡는 것이다.

현재 버튼 클릭 intent 수집은 운영에서 작동한다. 2026-04-30 11:50 KST 기준 live intent는 251건이고, 최근 24시간 `client_id`, `ga_session_id`, `product_idx` 채움률은 모두 100%다.

가장 큰 병목은 `intent`와 `실제 NPay 주문`을 붙이는 매칭 dry-run이다. 이 매칭이 통과해야 GA4 Measurement Protocol, Meta CAPI, TikTok Events API로 confirmed purchase를 보낼 수 있다.

2026-04-30 18:24 KST에 현재까지 쌓인 데이터로 예비 dry-run을 다시 돌렸다. live intent 296건과 confirmed NPay 주문 11건을 read-only로 대조했고, strong match 8건을 A급 6건/B급 2건으로 나눴다. ambiguous는 3건, purchase_without_intent는 0건이다. A급 6건 중 1건은 TJ 수동 테스트 주문이라 전송 후보에서 제외한다. 이 결과는 전환 전송용 확정값이 아니라 매칭 규칙 점검용이다.

## Phase-Sprint 요약표

| Phase | Sprint | 이름 | 담당 | 상태(우리/운영) | 상세 |
|---|---|---|---|---|---|
| Phase1 | [[#Phase1-Sprint1]] | 버튼 유지 원칙 | TJ + Codex | 100% / 100% | [[#Phase1-Sprint1]] |
| Phase1 | [[#Phase1-Sprint2]] | 클릭 intent 장부 | Codex | 100% / 100% | [[#Phase1-Sprint2]] |
| Phase2 | [[#Phase2-Sprint3]] | 실제 주문 매칭 | Codex | 55% / 0% | [[#Phase2-Sprint3]] |
| Phase2 | [[#Phase2-Sprint4]] | 미결제자 분리 | Codex | 50% / 0% | [[#Phase2-Sprint4]] |
| Phase3 | [[#Phase3-Sprint5]] | GA4/Meta/TikTok 전환 복구 | Codex + TJ | 20% / 0% | [[#Phase3-Sprint5]] |
| Phase3 | [[#Phase3-Sprint6]] | 운영 리포트와 승인 기준 | Codex + TJ | 30% / 0% | [[#Phase3-Sprint6]] |

## 문서 목적

이 문서는 네이버페이 외부 버튼을 유지하면서, 클릭 시도와 실제 결제를 분리해 ROAS 정합성을 회복하는 실행 계획을 정리한다.

## 이 작업이 하는 일

고객이 NPay 버튼을 누르면 `결제 시도`로 저장한다. 이후 운영 주문 원장에서 실제 NPay 결제가 확인되면 그 intent를 `결제 완료`로 승격한다.

결제 완료가 확인되지 않은 intent는 구매가 아니다. 이 사람은 `NPay 버튼 클릭 후 미결제`로 따로 본다.

## 왜 필요한가

기존 문제는 버튼 클릭과 실제 구매가 섞였다는 점이다. 버튼 클릭만으로 purchase를 잡으면 GA4, Meta, TikTok에서 매출이 부풀 수 있다.

반대로 네이버페이 결제 후 고객이 biocom으로 돌아오지 않으면 실제 구매가 GA4에서 빠질 수 있다. 이 경우 광고는 돈을 벌었는데 분석 도구에는 구매가 없는 것처럼 보인다.

따라서 정답은 버튼 제거가 아니라 `클릭 intent`와 `confirmed purchase`를 따로 저장하고, 실제 주문 원장으로만 구매를 확정하는 것이다.

## 현재 결론

| 질문 | 결론 | 이유 |
|---|---|---|
| 네이버페이 외부 버튼을 살릴까 | YES | 2026-04-01 ~ 2026-04-25 NPay 주문형 매출 17,905,200원, 전체 매출 4.65% |
| 버튼 클릭을 purchase로 볼까 | NO | 클릭은 결제 시도일 뿐 실제 주문이 아니다 |
| 클릭 intent 수집은 충분한가 | YES | 최근 24시간 핵심 필드 채움률 100% |
| 바로 GA4/Meta/TikTok purchase를 보낼까 | NO | 실제 주문 매칭률을 아직 검증하지 않았다 |
| 다음 1순위는 무엇인가 | 7일 매칭 dry-run | 클릭자와 결제자를 먼저 숫자로 분리해야 한다 |

## Dry-run이란

`dry-run`은 실제 운영 데이터를 읽어서 결과를 계산하지만, DB 상태를 바꾸거나 광고 플랫폼으로 전환을 보내지 않는 리허설이다.

쉽게 말하면 아래와 같다.

| 구분 | 실제 반영 | dry-run |
|---|---|---|
| 운영 DB 읽기 | 함 | 함 |
| `match_status` 업데이트 | 함 | 안 함 |
| GA4 purchase 전송 | 함 | 안 함 |
| Meta CAPI Purchase 전송 | 함 | 안 함 |
| TikTok CompletePayment 전송 | 함 | 안 함 |
| 결과 확인 | 운영에 반영됨 | 보고서로만 확인 |

이번 NPay 작업에서 dry-run은 `NPay 버튼 클릭 장부`와 `실제 NPay 주문 원장`을 붙여보되, 아직 아무 전환도 보내지 않는다는 뜻이다.

왜 필요한가:

1. 잘못 매칭된 주문을 GA4, Meta, TikTok에 보내면 ROAS가 더 망가진다.
2. 같은 주문을 두 번 보내면 매출이 부풀 수 있다.
3. 버튼 클릭만 하고 결제하지 않은 사람을 purchase로 보내면 광고 최적화가 잘못된다.
4. 그래서 먼저 read-only로 matched, ambiguous, clicked_no_purchase를 계산해야 한다.

▲ [[#Phase-Sprint 요약표|요약표로]]

## 현재 데이터 예비 분석

분석 시각: 2026-04-30 18:24 KST

이 분석은 7일치가 아니라 live publish 이후 약 3일치 데이터다. 결론을 확정하기에는 이르지만, 지금도 매칭 규칙이 대체로 작동하는지는 볼 수 있다.

| 항목 | 값 |
|---|---:|
| live publish 시각 | 2026-04-27 18:10 KST |
| intent 첫 수집 | 2026-04-27 18:16:44 KST |
| intent 최신 수집 | 2026-04-30 17:48 KST 기준 snapshot |
| live intent | 296건 |
| confirmed NPay 주문 | 11건 |
| strong match | 8건 |
| A급 strong | 6건 |
| A급 production 후보 | 5건 |
| B급 strong | 2건 |
| ambiguous | 3건 |
| 완전 미매칭 주문 | 0건 |
| clicked_no_purchase | 208건 |
| intent_pending | 80건 |

### 해석

현재 데이터로도 `버튼을 누른 뒤 실제 결제한 주문 후보`는 잡힌다. 특히 결제 완료 직전 1~8분 안에 같은 상품 intent가 있는 주문들이 보인다.

다만 11건 중 3건은 후보가 여러 개라 애매하다. 예를 들어 같은 상품을 몇 분 간격으로 여러 번 누른 기록이 있으면 어떤 클릭이 최종 결제로 이어졌는지 확정하기 어렵다.

또한 strong 8건 중 `202604283756893`와 `202604303298608`는 amount_match none 또는 금액 해석이 약해 B급으로 내렸다. 첫 dispatcher dry-run 후보는 A급 production 후보만 본다.

BigQuery 접근 권한이 아직 열리지 않은 주문은 `already_in_ga4=unknown`으로 유지한다. 따라서 NPay return/GA4 누락 문제와 GA4 MP 복구 필요성은 계속 검토하되, 이미 GA4에 있는 주문을 중복 전송하지 않기 위해 dispatcher dry-run에는 `already_in_ga4` guard를 반드시 둔다.

따라서 지금 결과는 `purchase 전송 가능`이 아니라 `예비 매칭 가능 + dispatcher 후보 등급화`로 봐야 한다. 특히 NPay는 Imweb `order_number`와 NPay `channel_order_no`가 다를 수 있으므로, BigQuery `already_in_ga4` guard는 두 ID를 모두 조회해야 한다.

### 현재 기준 판단

| 질문 | 답 |
|---|---|
| 지금 분석 가능한가 | 가능하다 |
| 지금 분석으로 전환 전송까지 열어도 되나 | 아직 안 된다 |
| 지금 볼 수 있는 것 | 클릭 수, confirmed NPay 주문 수, 강한 후보, 애매한 후보 |
| 아직 약한 것 | 회원/전화번호/주문번호 직접 연결, TikTok 식별값, 애매한 후보 처리 |
| 다음 조치 | 현재 예비 매칭 규칙을 코드화하고 7일치가 되는 시점에 같은 방식으로 재실행 |

### 정식 dry-run 코드

2026-04-30 18:07 KST에 dispatcher dry-run preview까지 포함해 매칭 로직을 코드로 고정했다.

| 산출물 | 위치 | 상태 |
|---|---|---|
| read-only 매칭 함수 | `backend/src/npayRoasDryRun.ts` | 로컬 구현 완료 |
| CLI 리포트 | `backend/scripts/npay-roas-dry-run.ts` | 로컬 실행 확인 |
| JSON API 초안 | `GET /api/attribution/npay-roas-dry-run` | 코드 초안 완료, 운영 배포 전 |
| 마크다운 리포트 | [[npay-roas-dry-run-20260430]] | 생성 완료 |
| `channel_order_no` 추출 | `tb_iamweb_users.raw_data.channelOrderNo` | 구현 완료 |
| BigQuery 조회 ID 목록 | `order_number + channel_order_no` | 리포트에 출력 |
| GA4 payload preview | `NPayRecoveredPurchase_{order_number}` | CLI/report only |

재실행 예시는 아래와 같다.

```bash
cd backend
NPAY_INTENT_DB_PATH=/home/biocomkr_sns/seo/shared/backend-data/crm.sqlite3 \
npm exec tsx scripts/npay-roas-dry-run.ts -- \
  --start=2026-04-27T09:10:00.000Z \
  --end=2026-05-04T09:10:00.000Z \
  --format=markdown
```

BigQuery에서 이미 GA4에 있는 주문을 확인한 뒤에는 아래처럼 guard 입력을 같이 넣는다. `ga4-present`에 들어간 ID는 전송 후보에서 제외된다. `ga4-absent`에는 Imweb `order_number`와 NPay `channel_order_no`를 모두 넣어야 한다. 둘 중 하나라도 present면 `already_in_ga4=present`, 두 ID가 모두 absent로 확인되어야 `already_in_ga4=absent`가 된다.

```bash
cd backend
NPAY_INTENT_DB_PATH=/home/biocomkr_sns/seo/shared/backend-data/crm.sqlite3 \
npm exec tsx scripts/npay-roas-dry-run.ts -- \
  --start=2026-04-27T09:10:00.000Z \
  --end=2026-05-04T09:10:00.000Z \
  --ga4-present=<이미_GA4에_있는_order_number_또는_channel_order_no_쉼표목록> \
  --ga4-absent=<GA4에_없는_order_number_및_channel_order_no_쉼표목록> \
  --format=markdown
```

TJ님 테스트 결제 주문은 아래처럼 라벨링한다. `test_order`는 매칭 검증에는 쓰지만 dispatcher 후보에서는 자동 제외된다.

```bash
cd backend
NPAY_INTENT_DB_PATH=/home/biocomkr_sns/seo/shared/backend-data/crm.sqlite3 \
npm exec tsx scripts/npay-roas-dry-run.ts -- \
  --start=2026-04-27T09:10:00.000Z \
  --end=2026-05-04T09:10:00.000Z \
  --test-order=<테스트_NPay_order_number> \
  --format=markdown
```

JSON API 초안은 같은 로직을 쓴다. 운영 배포 후에는 `NPAY_INTENT_ADMIN_TOKEN` 또는 bearer token이 있어야 조회된다.

```http
GET /api/attribution/npay-roas-dry-run?start=2026-04-27T09:10:00.000Z&end=2026-05-04T09:10:00.000Z&ga4Absent=202604280487104,202604285552452&testOrders=202605041234567
x-admin-token: <NPAY_INTENT_ADMIN_TOKEN>
```

이 코드는 `SELECT`와 SQLite readonly open만 사용한다. `npay_intent_log.match_status` 업데이트, GA4/Meta/TikTok/Google Ads purchase 전송, dispatcher 실행은 포함하지 않는다.

Phase2는 read-only 분석 단계다. 이 단계에서는 아래 작업을 하지 않는다.

| 금지 작업 | 이유 |
|---|---|
| DB `match_status` 업데이트 | 매칭 기준 확정 전 운영 상태를 바꾸면 추적 기준이 흔들림 |
| GA4/Meta/TikTok/Google Ads purchase 전송 | 오매칭 또는 중복 전송 시 ROAS가 더 망가짐 |
| 운영 endpoint 배포 | 현재 목표는 CLI/report 기준 검증이며 외부 호출면을 늘리지 않음 |

### Dispatcher dry-run preview

현재 단계는 실제 전송이 아니라 dispatcher dry-run이다. 리포트는 아래 항목을 생성하지만 어떤 endpoint도 호출하지 않는다.

| 필드 | 의미 |
|---|---|
| `order_number` | Imweb 주문번호 |
| `channel_order_no` | NPay 주문번호. Imweb 주문번호와 다를 수 있음 |
| `matched_intent_id` | 매칭된 `npay_intent_log.id` |
| `client_id` | GA4 Measurement Protocol에 쓸 client_id 후보 |
| `ga_session_id` | GA4 세션 연결 후보 |
| `value` | 주문 결제금액 |
| `currency` | `KRW` |
| `event_id` | `NPayRecoveredPurchase_{order_number}` |
| `send_candidate` | A급 strong + already_in_ga4 absent + production_order일 때만 Y |
| `block_reason` | 전송 금지 이유 |

현재 production A급 후보의 BigQuery 조회 대상 ID는 아래와 같다.

| Imweb order_number | NPay channel_order_no | 상태 |
|---|---|---|
| `202604280487104` | `2026042865542930` | BigQuery 확인 필요 |
| `202604285552452` | `2026042867285600` | BigQuery 확인 필요 |
| `202604303307399` | `2026043034982320` | BigQuery 확인 필요 |
| `202604309992065` | `2026043040116970` | BigQuery 확인 필요 |
| `202604302383065` | `2026043043205620` | BigQuery 확인 필요 |

중요: 위 ID 중 하나라도 GA4 raw/purchase에 있으면 해당 주문은 `already_in_ga4=present`로 막는다. 두 ID가 모두 absent로 확인된 주문만 dispatcher dry-run 후보가 된다.

7일치 재실행 시점은 2026-05-04 18:10 KST 이후다. 같은 CLI를 `--end=2026-05-04T09:10:00.000Z` 이상으로 다시 실행하고, 아래 기준을 모두 본다.

| Go 검토 기준 | 기준 |
|---|---:|
| A급 strong 비율 | 50% 이상 |
| ambiguous 비율 | 10% 이하 |
| purchase_without_intent 비율 | 20% 이하 |
| dispatcher 후보 주문의 `already_in_ga4` 확인률 | 100% |

이 기준을 통과해도 바로 Google Ads부터 열지 않는다. 내부 dispatcher dry-run log → GA4 MP 제한 테스트 → Meta CAPI 제한 테스트 → Google Ads는 마지막 순서로 검토한다.

### 예비 dry-run 상세 테이블

Source: VM SQLite `npay_intent_log` readonly snapshot, 운영 Postgres `public.tb_iamweb_users` readonly
Generated: 2026-04-30 18:07 KST
Window: 2026-04-27 18:10:00 KST ~ 2026-04-30 17:48:00 KST
Freshness: VM snapshot `2026-04-30 17:48 KST`
Confidence: 89%

상세 표는 [[npay-roas-dry-run-20260430]]에 생성했다. 이 문서에는 최신 판단만 요약한다.

| 항목 | 값 |
|---|---:|
| live intent | 296 |
| confirmed NPay 주문 | 11 |
| strong_match | 8 |
| A급 strong | 6 |
| A급 production 후보 | 5 |
| B급 strong | 2 |
| ambiguous | 3 |
| purchase_without_intent | 0 |
| shipping_reconciled | 1 |
| dispatcher 실제 후보 | 0 |

`product_idx_match`가 N/A인 이유는 `tb_iamweb_users` read model에 주문 상품의 아임웹 `product_idx`가 없다. 현재는 상품명과 금액을 기준으로만 본다.

`strong_match`도 아직 전송 금지다. 여기서 A급 strong은 "향후 dispatcher dry-run 후보"라는 뜻이지, 승인 없이 GA4/Meta/TikTok/Google Ads로 보낸다는 뜻이 아니다. B급 strong과 ambiguous 3건은 첫 dispatcher 후보에서 제외한다.

A급 기준은 `score >= 70`, `amount_match_type in (final_exact, shipping_reconciled, discount_reconciled, quantity_reconciled)`, `time_gap <= 2분`, `score_gap >= 15`다. B급 strong은 strong_match이지만 이 조건을 하나라도 만족하지 못한 주문이다.

### ambiguous 3건 원인 분해

Source: [[npay-roas-dry-run-20260430]]
Window: 2026-04-27 18:10 KST ~ 2026-04-30 17:48 KST
Confidence: 88%

| 원인 | 주문 수 | 해당 주문 |
|---|---:|---|
| `multiple_intents_same_product` | 3 | `202604275329932`, `202604289063428`, `202604295198830` |
| `same_product_multiple_clicks` | 3 | `202604275329932`, `202604289063428`, `202604295198830` |
| `low_score_gap` | 3 | `202604275329932`, `202604289063428`, `202604295198830` |
| `no_member_key` | 3 | `202604275329932`, `202604289063428`, `202604295198830` |
| `amount_not_reconciled` | 1 | `202604275329932` |
| `cart_multi_item_possible` | 1 | `202604275329932` |

해석: ambiguous 3건은 모두 같은 상품 intent가 여러 번 찍혔고 1등과 2등 후보의 점수차가 10점이라 자동 확정하기 어렵다. `202604275329932`는 금액도 맞지 않아 cart/multi-item 가능성이 있으므로 첫 dispatcher 후보에서 제외한다.

### clicked_no_purchase 208건 분해

Source: [[npay-roas-dry-run-20260430]]
Window: 2026-04-27 18:10 KST ~ 2026-04-30 17:48 KST
Definition: NPay 버튼 intent는 있지만 24시간 grace window 안에 confirmed NPay 주문 strong 매칭이 없는 건
Confidence: 86%. BigQuery와 주문 원장 지연 반영 가능성은 7일 재실행 때 다시 본다.

상품별 상위:

| product_idx | 상품 | clicked_no_purchase | 비중 |
|---|---|---:|---:|
| `97` | 바이오밸런스 90정 (1개월분) | 51 | 24.52% |
| `198` | 뉴로마스터 60정 (1개월분) | 38 | 18.27% |
| `317` | 혈당관리엔 당당케어 (120정) | 38 | 18.27% |
| `171` | 풍성밸런스 90정 (1개월분) | 19 | 9.13% |
| `386` | 메타드림 식물성 멜라토닌 함유 | 19 | 9.13% |
| `328` | 종합 대사기능&음식물 과민증 검사 Set | 18 | 8.65% |
| `300` | 영데이즈 저속노화 SOD 효소 (15포) | 15 | 7.21% |

광고키 조합별:

| ad_key_combo | clicked_no_purchase | 비중 |
|---|---:|---:|
| `gclid+fbp` | 179 | 86.06% |
| `fbp` | 19 | 9.13% |
| `fbclid+fbc+fbp` | 7 | 3.37% |
| 기타 | 3 | 1.44% |

시간대 피크:

| KST hour | clicked_no_purchase |
|---|---:|
| 2026-04-28 12:00 | 20 |
| 2026-04-29 14:00 | 15 |
| 2026-04-29 15:00 | 14 |
| 2026-04-29 12:00 | 13 |
| 2026-04-28 10:00 | 11 |
| 2026-04-28 13:00 | 11 |

해석: 현재 미구매 클릭은 보충제 SKU와 `gclid+fbp` 조합에 집중되어 있다. 이 값은 구매 전환으로 보내면 안 되고, 결제 UX 점검 또는 리마케팅 후보군으로만 써야 한다.

### TJ 수동 NPay 테스트 결제

Test case: `test_npay_manual_20260430`
Source: TJ manual payment, VM SQLite `npay_intent_log` readonly, TossPayments API read-only, Imweb legacy v2 API read-only, 운영 Postgres `public.tb_iamweb_users` readonly
Window: 2026-04-30 15:58-16:05 KST
Freshness: 확인 시각 2026-04-30 17:34 KST
Confidence: 92%

2026-04-30 16:00 KST TJ 수동 NPay 테스트 결제는 결제 완료 후 biocom `shop_payment_complete`로 자동 복귀하지 않았고, 네이버페이 완료 화면에서 종료되었다. 2026-04-30 16:22 KST 기준 BigQuery에는 `events_20260430` / `events_intraday_20260430` 테이블이 아직 보이지 않아 GA4 raw 누락 여부는 2026-05-01 재확인 대상으로 둔다.

| 항목 | 값 |
|---|---|
| 상품 URL | `https://biocom.kr/DietMealBox/?idx=424` |
| 상품명 | 팀키토 슬로우 에이징 도시락 7종 골라담기 |
| 옵션 | 수비드 간장치킨 |
| 실제 결제금액 | 11,900원 |
| 결제시각 | 2026-04-30 16:00 KST |
| 결제완료시각 | 2026-04-30 16:01-16:02 KST |
| 네이버페이 완료 URL | `https://orders.pay.naver.com/order/result/mall/2026043044799490` |
| NPay channel_order_no | `2026043044799490` |
| Imweb order_no | `202604309594732` |
| 자동 복귀 | 없음. `바이오컴 가기`를 눌러야 biocom 메인으로 이동 |

원천 확인 결과:

| source | 결과 |
|---|---|
| VM SQLite `npay_intent_log` | 2026-04-30 16:00:23 KST intent 1건 확인 |
| intent product_idx | `424` |
| intent product_name | 팀키토 슬로우 에이징 도시락 7종 골라담기 |
| intent product_price | 8,900 |
| duplicate_count | 0 |
| client_id / ga_session_id | 있음 / 있음 |
| Toss API `GET /v1/payments/orders/2026043044799490` | 404 `NOT_FOUND_PAYMENT` |
| Toss API `GET /v1/payments/orders/2026043044799490-P1` | 404 `NOT_FOUND_PAYMENT` |
| Toss API `GET /v1/transactions?startDate=2026-04-30&endDate=2026-04-30` | count 0, 11,900원 후보 없음 |
| Imweb v2 exact `GET /v2/shop/orders/2026043044799490` | 실패. 이 값은 아임웹 `order_no`가 아님 |
| Imweb v2 window `type=npay`, 15:55-16:10 KST | 1건 확인 |
| Imweb order_no / channel_order_no | `202604309594732` / `2026043044799490` |
| Imweb payment | `pay_type=npay`, `payment_amount=11900`, `total_price=8900`, `deliv_price=3000` |
| Imweb latest Open API `https://openapi.imweb.me/orders` | legacy token으로 401 |
| 운영 Postgres exact order_number `202604309594732` | 1건 확인 |
| 운영 Postgres exact order_number `2026043044799490` | 0건. 이 값은 `channel_order_no`라서 `order_number`에 없음 |
| 운영 Postgres payment | `payment_method=NAVERPAY_ORDER`, `payment_status=PAYMENT_COMPLETE`, `paid_price=11900`, `final_order_amount=11900` |
| 운영 Postgres 상품/옵션 | 팀키토 슬로우 에이징 도시락 7종 골라담기 / 슬로우 에이징 도시락:수비드 간장치킨 |
| 운영 Postgres 결제완료 | 2026-04-30 16:01:14 KST |

해석:

1. GTM intent 수집은 정상이다.
2. `2026043044799490`은 네이버페이 완료 URL과 Imweb `channel_order_no`다. 실제 Imweb 주문번호는 `202604309594732`다.
3. TossPayments API는 이번 주문의 정본이 아니다. `NOT_FOUND_PAYMENT`가 정상적인 결과로 보인다.
4. 운영 Postgres 주문 원장은 2026-04-30 17:33 KST 재확인 시점에는 테스트 주문을 포함한다.
5. 금액은 불일치가 아니라 배송비 포함 여부 차이다. `intent_product_price=8900`, `order_item_total=8900`, `delivery_price=3000`, `order_payment_amount=11900`이므로 `amount_match_type=shipping_reconciled`다.
6. 수정된 dry-run 기준 이 주문은 `strong_match`, A급, `score=80`이다.
7. `test_npay_manual_20260430` 라벨 때문에 dispatcher 후보에서는 자동 제외한다. 차단 사유는 `manual_test_order`다.

2026-05-01 BigQuery 재확인은 `202604309594732`와 `2026043044799490` 두 값을 모두 조회한다. 둘 중 하나라도 GA4 raw에 있으면 `already_in_ga4=present`로 두고 dispatcher 후보에서 제외한다. 둘 다 없을 때만 `already_in_ga4=absent`로 기록한다.

현재 누적 dry-run amount 보정 집계:

Source: VM SQLite `npay_intent_log` snapshot `/tmp/npay_roas_snapshot_20260430_1735.sqlite3`, 운영 Postgres `public.tb_iamweb_users` readonly
Window: 2026-04-27 18:10 KST ~ 2026-04-30 17:48 KST
Freshness: 2026-04-30 17:49 KST
Confidence: 86%. 아직 실제 7일치가 아니라 intent live publish 이후 약 72시간 누적이다.

| 항목 | 값 |
|---|---:|
| live intent | 296 |
| confirmed NPay order | 11 |
| strong_match | 8 |
| A급 strong | 6 |
| B급 strong | 2 |
| ambiguous | 3 |
| final_exact | 7 |
| shipping_reconciled | 1 |
| amount none | 3 |
| shipping_reconciled인데 A급으로 못 올라간 건 | 0 |

판단: 현재 누적 데이터에서는 배송비 때문에 정상 매칭이 B급/ambiguous로 떨어지는 사례는 0건이다. 이번 수동 테스트 주문 1건만 `shipping_reconciled`로 잡혔고 A급으로 승격됐다. 남은 B급/ambiguous의 `amount none` 3건은 배송비 문제가 아니라 상품/금액 후보 자체가 다르거나 후보가 애매한 건으로 별도 원인 분석 대상이다.

별도 리포트: [[npay-manual-test-20260430]]

▲ [[#Phase-Sprint 요약표|요약표로]]

## 핵심 구분

| 상태 | 의미 | 구매 전환 전송 |
|---|---|---|
| `intent_pending` | NPay 버튼을 눌렀고 아직 주문 매칭 전 | 전송 금지 |
| `clicked_no_purchase` | 버튼을 눌렀지만 정해진 시간 안에 confirmed NPay 주문 없음 | 전송 금지 |
| `clicked_purchased_candidate` | 버튼 intent와 confirmed NPay 주문이 strong 후보로 매칭됨 | 승인 후 전송 가능 |
| `purchase_without_intent` | NPay 주문은 있는데 버튼 intent가 없음 | 별도 원인 분석. 보수적으로 전송 보류 |
| `ambiguous` | 한 주문에 후보 intent가 여러 개거나 점수가 낮음 | 전송 금지 |

## Phase1-Sprint1

**이름**: 버튼 유지 원칙

### 결론

네이버페이 외부 주문형 버튼은 유지한다. 이번 문서의 목적은 버튼을 없애는 것이 아니라, 버튼 클릭과 최종 결제를 분리해서 추적하는 것이다.

### 왜 유지하는가

기존 `!npay` 문서 기준으로 2026년 4월 1일부터 4월 25일까지 NPay 주문형은 107건, 17,905,200원이다. 전체 매출의 4.65%다.

건강식품/영양제는 NPay 의존도가 더 높다. 이 상품군에서 버튼을 없애면 결제 편의성이 떨어질 수 있다.

### 운영 원칙

| 원칙 | 설명 |
|---|---|
| 버튼은 유지 | 상품 상세의 외부 NPay 주문형 버튼은 그대로 둔다 |
| 클릭은 구매가 아님 | NPay 버튼 클릭은 `npay_intent`로만 저장한다 |
| 구매는 주문 원장으로만 확정 | 취소, 환불, 미입금이 아닌 confirmed NPay 주문만 purchase 후보가 된다 |
| 광고 플랫폼 전송은 후행 | matching dry-run 통과 전에는 GA4/Meta/TikTok purchase 전송 금지 |

▲ [[#Phase-Sprint 요약표|요약표로]]

## Phase1-Sprint2

**이름**: 클릭 intent 장부

### 현재 상태

운영 GTM live version `139`에서 tag 118이 `POST /api/attribution/npay-intent`로 버튼 클릭 intent를 저장한다. 이 태그는 purchase를 보내지 않는다.

2026-04-30 11:50 KST 기준 수집 품질은 아래와 같다.

| 기준 | live 이후 | 최근 24시간 | 판정 |
|---|---:|---:|---|
| live intent row | 251 | 92 | 정상 |
| client_id 채움률 | 249/251, 99.2% | 92/92, 100% | 통과 |
| ga_session_id 채움률 | 248/251, 98.8% | 92/92, 100% | 통과 |
| product_idx 채움률 | 251/251, 100% | 92/92, 100% | 통과 |
| server purchase dispatch | 0 | 0 | 정상 |

### 저장된 값

| 구분 | 저장값 | 용도 |
|---|---|---|
| GA4 | `client_id`, `ga_session_id`, `ga_session_number` | GA4 세션에 구매를 붙일 후보값 |
| Google Ads | `gclid`, `gbraid`, `wbraid` | Google Ads 전환 복구 후보값 |
| Meta | `fbp`, `fbc`, `fbclid` | Meta CAPI purchase 복구 후보값 |
| 유입 | UTM, referrer, landing page | 캠페인과 랜딩 판단 |
| 상품 | `product_idx`, `product_name`, `product_price` | 주문 매칭 후보값 |
| 중복 | `intent_key`, `duplicate_count` | 버튼 중복 호출 흡수 |

### 한계

TikTok ROAS까지 안정적으로 회복하려면 `ttclid`, `_ttp` 같은 TikTok 식별값 수집도 필요하다. 현재 intent v1은 Google/Meta/GA4 식별값 중심이다.

이 추가는 DB 스키마와 GTM payload 변경이므로 별도 승인 후 진행한다. 그 전까지 TikTok은 UTM, referrer, 주문 매칭으로 보조 판단만 가능하다.

▲ [[#Phase-Sprint 요약표|요약표로]]

## Phase2-Sprint3

**이름**: 실제 주문 매칭

### 목표

`npay_intent_log`와 confirmed NPay 주문 원장을 붙여 `누가 버튼만 눌렀는지`, `누가 실제 결제했는지`를 나눈다.

### 주문 정본

Primary source는 `operational_postgres.public.tb_iamweb_users`다.

confirmed NPay 주문은 아래 조건으로 본다.

| 조건 | 기준 |
|---|---|
| 결제수단 | `NAVERPAY_ORDER`, `npay`, `naver`, `네이버` 계열 |
| 제외 | 취소, 환불, 미입금, 결제 준비 |
| 주문 단위 | `order_number` 기준 |
| 금액 | 주문 기준 최종 결제금액 |

### 매칭 규칙

자동 확정은 보수적으로 시작한다. 클릭과 주문이 비슷해 보여도 애매하면 purchase를 보내지 않는다.

현재 `backend/src/npayRoasDryRun.ts`의 v1 점수는 "전송 확정"이 아니라 "향후 전송 후보 선별" 용도다. 회원/전화번호 직접키가 아직 없으므로, 시간·상품명·금액·2등 후보와의 점수차를 우선 본다.

| 조건 | 점수 |
|---|---:|
| intent 이후 1분 이내 결제 | +30 |
| intent 이후 15분 이내 결제 | +20 |
| intent 이후 60분 이내 결제 | +10 |
| 상품명 exact 일치 | +30 |
| 상품명 contains 일치 | +24 |
| 상품명 token overlap | +14 |
| 금액 exact 일치 | +20 |
| 금액이 상품가의 정수배 | +12 |
| 금액 5% 이내 근접 | +8 |
| 같은 `member_code` 또는 같은 회원 해시 | v2 보강 예정 |
| 같은 `product_idx` | 운영 주문 원장에 product_idx가 없어 v1은 N/A |
| 같은 `client_id`와 `ga_session_id` | 주문 원장에 세션값이 없어 v1은 presence만 표시 |

`strong_match`는 `best_score >= 50`이고 `best_score - second_score > 10`일 때만 붙인다. 점수차가 정확히 10점이면 아직 동점권으로 보고 `ambiguous`다.

strong은 다시 A급/B급으로 나눈다.

| 등급 | 기준 | 첫 dispatcher 후보 |
|---|---|---|
| A급 strong | `score >= 70`, `amount_match_type in (final_exact, shipping_reconciled, discount_reconciled, quantity_reconciled)`, `time_gap <= 2분`, `score_gap >= 15` | 가능 |
| B급 strong | strong_match지만 A급 조건 중 하나라도 실패 | 제외 |

중요: A급 strong도 아직 purchase 전송 허가가 아니다. 지금 단계의 A급은 "향후 dispatcher dry-run 후보"라는 뜻이고, 실제 GA4/Meta/TikTok/Google Ads 전송은 별도 승인 전까지 금지다.

dispatcher dry-run은 `already_in_ga4` guard를 반드시 본다. BigQuery에서 같은 `transaction_id`가 GA4 purchase 또는 raw event로 이미 존재하면 `already_in_ga4=present`로 표시하고 전송 후보에서 제외한다. BigQuery 확인이 아직 안 된 주문은 `already_in_ga4=unknown`으로 두고 역시 전송 후보에서 제외한다.

### 산출물

| 산출물 | 설명 |
|---|---|
| matched 리포트 | intent와 주문이 확실히 붙은 건 |
| clicked_no_purchase 리포트 | 버튼은 눌렀지만 주문이 없는 건 |
| purchase_without_intent 리포트 | NPay 주문은 있는데 intent가 없는 건 |
| ambiguous 리포트 | 후보가 여러 개라 구매 전송하면 위험한 건 |

▲ [[#Phase-Sprint 요약표|요약표로]]

## Phase2-Sprint4

**이름**: 미결제자 분리

### 왜 중요한가

버튼을 눌렀지만 결제하지 않은 사람은 구매자가 아니다. 이들을 구매로 보내면 GA4, Meta, TikTok ROAS가 부풀고 광고 최적화가 잘못된다.

하지만 이들은 버릴 데이터도 아니다. 장바구니 이탈, 결제 이탈, 리마케팅 대상이 될 수 있다.

### 상태 전환

| 기준 | 상태 |
|---|---|
| intent 생성 직후 | `intent_pending` |
| intent 이후 24시간 안에 confirmed NPay 주문 strong 매칭 | `clicked_purchased_candidate` |
| strong_match이고 A급 조건 충족, `already_in_ga4=absent` | dispatcher dry-run 후보 |
| strong_match지만 B급 조건 | 첫 dispatcher 후보 제외 |
| intent 이후 24시간 동안 주문 없음 | `clicked_no_purchase` |
| 후보 주문은 있지만 점수차가 좁거나 후보가 여러 개 | `ambiguous` |
| confirmed NPay 주문이 있는데 intent 없음 | `purchase_without_intent` |

### 운영 활용

| 그룹 | 의미 | 활용 |
|---|---|---|
| `clicked_no_purchase` | 결제창까지 갔다가 빠진 사람 | 리마케팅, 결제 UX 점검, 상품별 이탈률 확인 |
| `clicked_purchased_candidate` | 실제 NPay 구매 strong 후보 | A/B 등급과 GA4 중복 guard를 거쳐 dispatcher 후보 판단 |
| `purchase_without_intent` | 수집 누락 또는 다른 경로 구매 | GTM selector, 브라우저 차단, 주문 sync 보정 |
| `ambiguous` | 확정 위험 | 수동 검토 또는 전송 제외 |

▲ [[#Phase-Sprint 요약표|요약표로]]

## Phase3-Sprint5

**이름**: GA4/Meta/TikTok 전환 복구

### 원칙

광고 플랫폼에는 `confirmed purchase`만 보낸다. 버튼 클릭 intent는 구매 전환으로 보내지 않는다.

### 플랫폼별 처리

| 플랫폼 | 보낼 이벤트 | 조건 | 현재 판단 |
|---|---|---|---|
| GA4 | Measurement Protocol `purchase` | A급 strong, `already_in_ga4=absent`, 테스트 주문 아님 | 7일 dry-run 후 승인 |
| Meta | CAPI `Purchase` | A급 strong, `fbp` 또는 `fbc/fbclid` 있음, `already_in_ga4=absent` | 7일 dry-run 후 승인 |
| TikTok | Events API `CompletePayment` | A급 strong + `ttclid` 또는 `_ttp` 확보 후 | 식별값 수집 보강 필요 |
| Google Ads | confirmed conversion 또는 offline conversion | A급 strong + `gclid/gbraid/wbraid` 있음 | 마지막 단계, 별도 승인 필요 |

### TikTok 보강 필요

현재 `npay_intent_log`에는 TikTok 전용 식별값이 없다. TikTok ROAS 정합성까지 닫으려면 아래 값을 추가 수집해야 한다.

| 값 | 설명 | 필요 이유 |
|---|---|---|
| `ttclid` | TikTok click id | TikTok 광고 클릭과 구매 매칭 |
| `_ttp` | TikTok browser id cookie | Events API dedup/매칭 보조 |
| `ttp` | 서버 전송용 TikTok id | TikTok Events API 품질 보강 |
| TikTok UTM | campaign/adgroup/ad 구분 | 광고 세트별 ROAS 판단 |

이 보강은 운영 DB 스키마 변경 가능성이 있으므로 TJ 승인 후 별도 작업으로 진행한다.

### 전송 금지 조건

| 조건 | 이유 |
|---|---|
| `intent_pending` | 아직 구매가 아니다 |
| `clicked_no_purchase` | 명확히 미구매다 |
| `ambiguous` | 다른 주문에 잘못 붙일 수 있다 |
| `purchase_without_intent` | 광고 attribution이 불명확하다 |
| B급 strong | 매칭은 가능하지만 첫 dispatcher 후보 기준 미달 |
| `already_in_ga4=present` | 이미 GA4에 있는 주문이라 중복 전송 위험 |
| `already_in_ga4=unknown` | BigQuery 중복 확인 전이라 보수적으로 보류 |
| `test_order` | 검증용 결제라 광고 최적화에 보내면 안 된다 |
| 중복 dispatch 기록 있음 | 같은 주문을 두 번 보낼 수 있다 |

▲ [[#Phase-Sprint 요약표|요약표로]]

## Phase3-Sprint6

**이름**: 운영 리포트와 승인 기준

### 매일 봐야 할 숫자

| 지표 | 의미 |
|---|---|
| NPay intent 수 | 버튼 클릭 시도 |
| confirmed NPay 주문 수 | 실제 NPay 결제 |
| clicked_purchased_candidate 수 | 클릭과 주문이 strong 후보로 붙은 구매 |
| A급 strong 수 | 첫 dispatcher dry-run 후보가 될 수 있는 주문 |
| B급 strong 수 | strong이지만 첫 dispatcher 후보에서 제외할 주문 |
| already_in_ga4 present 수 | 중복 전송 차단 주문 |
| already_in_ga4 unknown 수 | BigQuery 확인 전 보류 주문 |
| test_order 수 | TJ 테스트 결제 등 광고 전송 제외 주문 |
| clicked_no_purchase 수 | 버튼 클릭 후 미결제 |
| purchase_without_intent 수 | intent 누락 가능성 |
| ambiguous 수 | 자동 전송하면 위험한 후보 |
| 후보 매칭률 | `clicked_purchased_candidate / confirmed NPay 주문` |
| 이탈률 | `clicked_no_purchase / 전체 intent` |

### Go 기준

| 항목 | Go 기준 |
|---|---:|
| intent 핵심 필드 채움률 | `client_id`, `ga_session_id`, `product_idx` 90% 이상 |
| A급 strong 비율 | confirmed NPay 주문의 50% 이상부터 검토 |
| B급 strong 처리 | 첫 dispatcher 후보 제외 |
| ambiguous 비율 | confirmed NPay 주문의 10% 이하 |
| purchase_without_intent 비율 | confirmed NPay 주문의 20% 이하 |
| already_in_ga4 확인률 | dispatcher 후보 주문 100% |
| 중복 dispatch | 0건 |

이 기준은 첫 운영 기준이다. 실제 7일 dry-run 결과가 나오면 조정한다.

### 다음 실행 단계

| 순서 | 담당 | 무엇을 하는가 | 왜 하는가 | 어떻게 하는가 | 산출물 |
|---:|---|---|---|---|---|
| 1 | Codex | 7일 dry-run을 재실행한다 | 2.9일치가 아니라 7일치 기준으로 A/B/ambiguous를 봐야 한다 | `--start=2026-04-27T09:10:00.000Z --end=2026-05-04T09:10:00.000Z` | 7일 리포트 |
| 2 | TJ | dispatcher 후보 주문의 BigQuery 존재 여부를 확인한다 | 이미 GA4에 있는 주문을 MP로 다시 보내면 중복이다 | `transaction_id`를 purchase와 전체 event_name 기준으로 조회 | `ga4-present`, `ga4-absent` 목록 |
| 3 | Codex | BigQuery guard가 반영된 dispatcher dry-run을 만든다 | purchase 전송 전에 중복과 금액 오류를 막는다 | A급 strong + already_in_ga4=absent만 payload 후보로 표시 | dry-run dispatch log |
| 4 | TJ | 테스트 NPay 결제 1건을 수행한다 | 실제 클릭→결제 매칭이 의도대로 되는지 검증한다 | 주문번호를 Codex에게 전달하고 `--test-order=`로 라벨링 | test_order 리포트 |
| 5 | Codex | TikTok 식별값 수집 보강안을 만든다 | TikTok ROAS는 현재 v1 필드만으로 부족하다 | `ttclid`, `_ttp`, TikTok UTM 추가 범위 산정 | 승인안 |
| 6 | TJ | 실제 전송 순서를 승인한다 | 광고 플랫폼 신호가 바뀐다 | GA4 먼저, Meta 다음, Google Ads 마지막, TikTok은 식별값 보강 후 | 단계별 승인 |

▲ [[#Phase-Sprint 요약표|요약표로]]

## Codex 추천

추천은 `네이버페이 외부 버튼 유지 + 클릭/구매 분리 원장 고도화`다.

자신감은 84%다. 버튼 클릭 intent 수집 품질은 이미 운영에서 통과했기 때문에 방향은 강하다. 다만 실제 주문 매칭률과 TikTok 식별값 확보 상태가 아직 부족하므로, purchase dispatcher는 바로 열지 않는 것이 맞다.

## TJ 결정 필요

지금 당장 TJ님이 결정할 것은 하나다.

| 선택지 | 의미 | Codex 추천 |
|---|---|---|
| YES: 7일 매칭 dry-run 먼저 진행 | 버튼은 유지하고, 클릭자/구매자 분리 리포트부터 만든다 | 추천 |
| NO: 보류 | intent 수집만 유지하고 주문 매칭은 나중에 한다 | 비추천 |

Codex 추천 답변은 아래다.

```text
YES: 7일 매칭 dry-run 먼저 진행
```
