# 네이버페이 ROAS 정합성 회복 계획

작성 시각: 2026-04-30 21:30 KST
기준일: 2026-04-30
관련 문서: [[!npay|네이버페이 주문형 결제형 전환 검토]], [[npay-intent-quality-20260430|NPay Intent 수집 품질 점검]], [[npay-roas-dry-run-20260430]], [[npay-roas-dry-run-vm-snapshot-20260505]], [[npay-ga4-recovery-sample-payload-approval-20260505]], [[../gdn/google-ads-confirmed-purchase-operational-dry-run-20260505]], [[../ontology/!ontology|Attribution Ontology Lite]], [[npay-early-phase2-approval-20260430]], [[npay-ga4-mp-limited-test-approval]], [[npay-ga4-mp-limited-test-result-20260430]], [[npay-phase2-followup-20260430]], [[npay-7d-rerun-checklist-20260504]], [[GA4/gtm|biocom GTM 컨테이너 상태 정리]]
Primary source: VM SQLite `npay_intent_log`, 운영 주문 원장 `operational_postgres.public.tb_iamweb_users`
Cross-check: 보호된 `GET /api/attribution/npay-intents`, GTM API live version `139`, TJ BigQuery robust query
Window: NPay intent는 2026-04-27 18:10 KST 이후, 주문 원장은 dry-run window 기준 `PAYMENT_COMPLETE` NPay 주문
Freshness: dry-run report `2026-05-05 22:35 KST`, 분석 window end `2026-05-06 00:00 KST`, VM snapshot max `2026-05-05 21:53 KST`, BigQuery robust guard `2026-05-05 22:34 KST`
Confidence: 94%

## 10초 요약

새 목적은 `네이버페이 버튼을 없앨지`가 아니다. 버튼은 외부 주문형으로 살리되, `버튼만 누르고 결제하지 않은 사람`과 `버튼을 누른 뒤 실제 NPay 결제까지 완료한 사람`을 분리해 GA4, Meta, TikTok ROAS를 바로잡는 것이다.

용어 기준은 [[../ontology/!ontology|Attribution Ontology Lite]]를 따른다. NPay는 결제수단이지 Naver Ads 유입 증거가 아니다. 따라서 `NPay click/count/payment start`는 purchase가 아니고, 운영 원장에 있는 `NPay actual confirmed order`만 내부 confirmed 매출과 confirmed purchase 후보가 된다.

현재 버튼 클릭 intent 수집은 운영에서 작동한다. 2026-04-30 21:25 KST 기준 dry-run window 안의 live intent는 304건이고, 최근 점검 기준 `client_id`, `ga_session_id`, `product_idx` 채움률은 모두 운영 기준을 통과했다.

가장 큰 병목은 `intent`와 `실제 NPay 주문`을 붙이는 매칭 dry-run이다. 이 매칭이 통과해야 GA4 Measurement Protocol, Meta CAPI, TikTok Events API로 confirmed purchase를 보낼 수 있다.

2026-04-30 21:25 KST에 현재까지 쌓인 데이터로 예비 dry-run을 다시 돌렸다. live intent 304건과 confirmed NPay 주문 11건을 read-only로 대조했고, strong match 8건을 A급 6건/B급 2건으로 나눴다. ambiguous는 3건, purchase_without_intent는 0건이다.

TJ님이 A급 production 후보 5건의 Imweb `order_number`와 NPay `channel_order_no` 총 10개 ID를 BigQuery robust query로 확인했고, GA4 raw/purchase 전체에서 표시할 데이터 없음으로 나왔다. 그중 `202604302383065` 1건은 TJ님 승인대로 2026-04-30 21:23 KST에 GA4 MP 제한 테스트로 전송했다. 이후 dry-run에서는 이 주문을 `already_in_ga4=present`로 막아 중복 전송하지 않는다. 남은 dispatcher dry-run 후보는 4건이고, Meta/TikTok/Google Ads 전송은 여전히 0건이다.

2026-05-05에는 운영 VM을 SSH read-only로 확인해 SQLite snapshot을 로컬로 가져왔다. 이제 `NPay intent source 접근 불가`가 아니라 `source 접근 해결, GA4 중복 guard 완료` 상태다. snapshot 기준 live intent는 820건, confirmed NPay 주문은 30건, strong match는 20건이다. 이 중 A급 strong은 10건이고, BigQuery guard 결과 2건은 이미 GA4 purchase에 존재하며 8건은 robust_absent로 확인됐다.

자동 전송은 계속 금지다. 이유는 ambiguous 10건이 남아 있고, 실제 GA4 Measurement Protocol 전송은 외부 플랫폼 송출이기 때문이다. 2026-05-05 23:22 KST에 robust_absent 8건의 payload 승인안은 [[npay-ga4-recovery-sample-payload-approval-20260505]]로 작성했다. 다만 TJ님 지시에 따라 8건은 전송 목표가 아니라 파이프라인 검증 샘플로만 본다.

다음 1순위는 8건 복구가 아니다. 운영 DB, Attribution VM, GA4 BigQuery를 read-only로 조인해 `NPay 실제 결제완료 주문만 purchase 후보로 남기는 confirmed purchase 파이프라인`을 만드는 것이다. Google Ads 쪽 no-send 확장 결과는 [[../gdn/google-ads-confirmed-purchase-operational-dry-run-20260505]]에 기록했다.

## Phase-Sprint 요약표

| Phase | Sprint | 이름 | 담당 | 상태(우리/운영) | 상세 |
|---|---|---|---|---|---|
| Phase1 | [[#Phase1-Sprint1]] | 버튼 유지 원칙 | TJ + Codex | 100% / 100% | [[#Phase1-Sprint1]] |
| Phase1 | [[#Phase1-Sprint2]] | 클릭 intent 장부 | Codex | 100% / 100% | [[#Phase1-Sprint2]] |
| Phase2 | [[#Phase2-Sprint3]] | 실제 주문 매칭 | Codex | 94% / 0% | [[#Phase2-Sprint3]] |
| Phase2 | [[#Phase2-Sprint4]] | 미결제자 분리 | Codex | 82% / 0% | [[#Phase2-Sprint4]] |
| Phase3 | [[#Phase3-Sprint5]] | GA4/Meta/TikTok 전환 복구 | Codex + TJ | 62% / 5% | [[#Phase3-Sprint5]] |
| Phase3 | [[#Phase3-Sprint6]] | 운영 리포트와 승인 기준 | Codex + TJ | 80% / 0% | [[#Phase3-Sprint6]] |

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
| 바로 GA4/Meta/TikTok purchase를 보낼까 | NO | GA4 MP는 승인된 1건만 제한 테스트로 보냈고, 대량 전송은 금지다 |
| 다음 1순위는 무엇인가 | confirmed purchase 실시간/준실시간 파이프라인 | 8건은 파이프라인 검증 샘플일 뿐이다. 앞으로 NPay 실제 결제완료 주문만 purchase로 보낼 수 있어야 한다 |

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

### 2026-05-05 운영 VM snapshot 재실행

Source: TJ 관리 Attribution VM SQLite snapshot `/home/biocomkr_sns/seo/shared/backend-data/crm.sqlite3`, 로컬 복사본 `backend/data/vm-npay-intent-20260505.sqlite3`, 운영 Postgres `public.tb_iamweb_users` readonly
Window: `2026-04-27T09:10:00.000Z ~ 2026-05-05T15:00:00.000Z`
Freshness: VM snapshot max `2026-05-05T12:53:37.491Z`, local integrity check PASS
Report: [[npay-roas-dry-run-vm-snapshot-20260505]]
Confidence: 92%

운영 VM 접근은 해결됐다. 로컬 `.env`에는 `NPAY_INTENT_ADMIN_TOKEN`이 없었지만, 운영 VM의 SQLite 원장을 `sudo sqlite3 .backup`으로 read-only snapshot 처리해 로컬에서 dry-run을 다시 실행했다. 토큰 원문은 읽거나 문서화하지 않았다.

| 항목 | 값 |
|---|---:|
| live intent | 820건 |
| confirmed NPay 주문 | 30건 |
| strong match | 20건 |
| A급 strong | 10건 |
| B급 strong | 10건 |
| ambiguous | 10건 |
| purchase_without_intent | 0건 |
| clicked_purchased_candidate | 20건 |
| clicked_no_purchase | 709건 |
| intent_pending | 91건 |
| dispatcher dry-run 후보 | 0건 |

해석은 명확하다.

1. `purchase_without_intent=0`이므로, 이번 window 안의 confirmed NPay 주문은 모두 어떤 형태로든 NPay 버튼 클릭 intent 근거가 있다.
2. A급 strong 10건은 주문 직전 intent, 상품/금액 일치, score gap 기준을 통과했다.
3. 하지만 `already_in_ga4=unknown`이 30건이라 어떤 주문도 전송 후보가 아니다.
4. ambiguous 10건은 전체 confirmed NPay 주문 30건의 33.33%라 자동 dispatcher 기준을 통과하지 못한다.

따라서 현재 결론은 `source 접근 해결 + 매칭 가능성 확인 + 자동 전송 금지 유지`다.

다음 확인 대상 A급 strong 10건은 아래와 같다. 각 주문은 Imweb `order_number`와 NPay `channel_order_no` 두 값을 모두 BigQuery에서 조회해야 한다.

| order_number | channel_order_no | 금액 | 상품 |
|---|---|---:|---|
| `202604280487104` | `2026042865542930` | 35,000원 | 뉴로마스터 |
| `202604285552452` | `2026042867285600` | 496,000원 | 종합 대사기능&음식물 과민증 검사 Set |
| `202604303307399` | `2026043034982320` | 496,000원 | 종합 대사기능&음식물 과민증 검사 Set |
| `202604309992065` | `2026043040116970` | 35,000원 | 뉴로마스터 |
| `202604302383065` | `2026043043205620` | 35,000원 | 뉴로마스터 |
| `202604309594732` | `2026043044799490` | 11,900원 | 팀키토 슬로우 에이징 도시락 |
| `202605011540306` | `2026050158972710` | 496,000원 | 종합 대사기능&음식물 과민증 검사 Set |
| `202605026187995` | `2026050280712120` | 35,000원 | 뉴로마스터 |
| `202605027178971` | `2026050281216190` | 496,000원 | 종합 대사기능&음식물 과민증 검사 Set |
| `202605031873910` | `2026050331688110` | 496,000원 | 종합 대사기능&음식물 과민증 검사 Set |

중요: `202604302383065`은 2026-04-30 GA4 MP 제한 테스트에 사용한 주문이다. BigQuery guard에서는 반드시 `present` 또는 별도 차단 상태로 두고, 향후 재전송 후보에서 제외해야 한다.

### 2026-05-05 GA4 BigQuery robust guard 결과

Report: [[npay-ga4-robust-guard-vm-snapshot-20260505]], [[npay-roas-dry-run-vm-snapshot-20260505-ga4-guarded]]
Source dataset: `hurdlers-naver-pay.analytics_304759974`
Job project: `project-dadba7dd-0229-4ff6-81c`
Location: `asia-northeast3`
Window: `events_20260427` ~ `events_20260505`
Mode: BigQuery read-only, no-send, no-write

A급 strong 10건의 `order_number + channel_order_no` 20개 ID를 GA4 BigQuery에서 조회했다.

| 항목 | 값 |
|---|---:|
| guard ID | 20개 |
| GA4 present ID | 4개 |
| GA4 robust_absent ID | 16개 |
| GA4 present 주문 | 2건 |
| GA4 robust_absent 주문 | 8건 |
| guarded dry-run dispatcher 후보 | 8건 |

GA4에 이미 존재한 주문은 아래 2건이다. 둘 중 하나라도 `order_number` 또는 `channel_order_no`가 GA4 purchase에 있으면 중복 위험이 있으므로 전송 후보에서 제외한다.

| order_number | channel_order_no | 판정 |
|---|---|---|
| `202604309992065` | `2026043040116970` | already_in_ga4=present |
| `202604302383065` | `2026043043205620` | already_in_ga4=present, 2026-04-30 제한 테스트 주문 |

robust_absent로 남은 8건은 no-send 기준 dispatcher 후보가 됐다. 이 말은 `바로 보내도 된다`가 아니라, `A급 매칭이고 GA4 중복도 보이지 않으므로 제한 복구 전송 승인안에 올릴 수 있다`는 뜻이다.

다음 단계는 실제 GA4 Measurement Protocol 전송이므로 Green Lane이 아니다. TJ님 승인 전까지 전송, 운영 DB write, Meta/TikTok/Google Ads 송출은 모두 금지한다.

분석 시각: 2026-04-30 21:25 KST

이 분석은 7일치가 아니라 live publish 이후 약 3일치 데이터다. 결론을 확정하기에는 이르지만, 지금도 매칭 규칙이 대체로 작동하는지는 볼 수 있다.

| 항목 | 값 |
|---|---:|
| live publish 시각 | 2026-04-27 18:10 KST |
| intent 첫 수집 | 2026-04-27 18:16:44 KST |
| intent 최신 수집 | 2026-04-30 21:25 KST 기준 snapshot |
| live intent | 304건 |
| confirmed NPay 주문 | 11건 |
| strong match | 8건 |
| A급 strong | 6건 |
| A급 production 후보 | 5건 |
| A급 production `robust_absent` | 4건 |
| GA4 MP 제한 테스트 전송 | 1건, `202604302383065` |
| B급 strong | 2건 |
| ambiguous | 3건 |
| 완전 미매칭 주문 | 0건 |
| dispatcher dry-run 후보 | 4건 |
| 실제 GA4 MP 전송 | 1건 |
| Meta/TikTok/Google Ads 전송 | 0건 |
| clicked_no_purchase | 209건 |
| intent_pending | 87건 |

### 해석

현재 데이터로도 `버튼을 누른 뒤 실제 결제한 주문 후보`는 잡힌다. 특히 결제 완료 직전 1~8분 안에 같은 상품 intent가 있는 주문들이 보인다.

다만 11건 중 3건은 후보가 여러 개라 애매하다. 예를 들어 같은 상품을 몇 분 간격으로 여러 번 누른 기록이 있으면 어떤 클릭이 최종 결제로 이어졌는지 확정하기 어렵다.

또한 strong 8건 중 `202604283756893`와 `202604303298608`는 amount_match none 또는 금액 해석이 약해 B급으로 내렸다. 첫 dispatcher dry-run 후보는 A급 production 후보만 본다. 단, `202604302383065`은 이미 GA4 MP 제한 테스트로 전송했으므로 이후 후보에서 제외한다.

BigQuery robust query 결과 A급 production 후보 5건의 10개 ID는 GA4 raw/purchase 전체에서 조회되지 않았다. 따라서 이 5건은 `already_in_ga4=robust_absent`로 표시한다. 다만 B급 strong, ambiguous, 수동 테스트 주문은 여전히 전송 금지다.

따라서 지금 결과는 `purchase 전송 가능`이 아니라 `예비 매칭 가능 + dispatcher 후보 등급화`로 봐야 한다. 특히 NPay는 Imweb `order_number`와 NPay `channel_order_no`가 다를 수 있으므로, BigQuery `already_in_ga4` guard는 두 ID를 모두 조회해야 한다.

### 현재 기준 판단

| 질문 | 답 |
|---|---|
| 지금 분석 가능한가 | 가능하다 |
| 지금 분석으로 전환 전송까지 열어도 되나 | 아직 안 된다 |
| 지금 볼 수 있는 것 | 클릭 수, confirmed NPay 주문 수, 강한 후보, 애매한 후보 |
| 아직 약한 것 | 회원/전화번호/주문번호 직접 연결, TikTok 식별값, 애매한 후보 처리 |
| 다음 조치 | GA4 MP 1-2건 제한 테스트 승인 여부를 결정하고, B급/ambiguous는 제외 유지, 7일치로 후보정 |

### 7일 전 조기 진행 + 7일 후보정 방안

결론: 7일치를 기다리기만 하지 않는다. 현재 누적 데이터는 `실제 전송`을 자동으로 열기에는 부족하지만, Phase2의 read-only 판단과 Phase3 제한 테스트 승인안 준비에는 충분하다.

근거는 세 가지다.

1. 현재 표본이 작지만 비어 있지 않다. live intent 304건, confirmed NPay 주문 11건, A급 production 후보 5건, purchase_without_intent 0건까지 나왔다.
2. A급 후보는 결제 직전 2분 이내, 금액 일치 또는 배송비 조정 일치, 점수차 15점 이상이라는 보수 기준을 통과했다.
3. GA4 Measurement Protocol은 과거 이벤트 전송에 시간 제약이 있다. Google 공식 문서 기준 과거 timestamp는 72시간 기준을 보며, session attribution 목적이면 session start 이후 24시간 이내 전송 요구가 있다. 따라서 7일을 기다린 뒤 과거 주문을 한꺼번에 복구하면 GA4 세션 귀속 품질이 떨어질 수 있다. 참고: https://developers.google.com/analytics/devguides/collection/protocol/ga4/sending-events, https://developers.google.com/analytics/devguides/collection/protocol/ga4/use-cases

#### 현재 데이터로 지금 진행할 수 있는 것

| 작업 | 지금 진행 여부 | 이유 | 방법 | 금지선 |
|---|---|---|---|---|
| BigQuery guard ID 조회 | 완료 | A급 production 후보 5건의 10개 ID가 GA4 raw/purchase 전체에서 조회되지 않았다 | TJ robust query 결과를 `robust_absent`로 반영 | 조회 전송 아님 |
| B급 strong 2건 수동 검토 | 진행 | 금액/장바구니 해석을 고치면 후보가 늘 수 있다 | Top Candidate Intents에서 상품/금액/시간을 표로 분해 | 자동 전송 금지 |
| ambiguous 3건 수동 검토 | 진행 | ambiguous 비율이 27.3%라 현재 Go 기준 10%를 넘는다 | low_score_gap, same_product_multiple_clicks, no_member_key별로 제외/보강 판단 | ambiguous 전송 금지 |
| GA4 MP 제한 테스트 | 완료/검증 대기 | 72시간 신선도 때문에 7일 대기만 하면 복구 가치가 낮아질 수 있다 | `202604302383065` 1건 전송 완료, BigQuery 수신 확인 대기 | 같은 주문 재전송 금지 |
| clicked_no_purchase 운영 해석 | 진행 | 209건이면 상품/광고키별 이탈 가설은 세울 수 있다 | 상품, 광고키, 시간대 상위 항목에 원인 가설 작성 | 리마케팅 audience 전송 금지 |

#### 7일치가 될 때까지 기다려야 하는 것

| 작업 | 대기 이유 | 7일 후보정 방식 |
|---|---|---|
| 자동 dispatcher 운영 전환 | 현재 주문 11건은 표본이 작고 ambiguous 3건이 높다 | 2026-05-04 18:10 KST 이후 같은 CLI로 재실행해 A급/ambiguous/purchase_without_intent 비율을 재계산 |
| Google Ads 전환 복구 | 오매칭이 입찰 학습에 직접 영향을 준다 | GA4 제한 테스트와 Meta CAPI 제한 테스트 이후 별도 승인 |
| TikTok ROAS 복구 | `ttclid`, `_ttp`가 아직 없다 | 식별값 수집 보강 후 별도 dry-run |
| 리마케팅 audience 사용 | 미구매자 정의는 맞지만 보관 기간/제외 조건이 필요하다 | 7일치 clicked_no_purchase 분포로 audience 조건 후보정 |

#### 추천안

추천은 `조기 제한 진행안`이다.

| 안 | 설명 | 장점 | 리스크 | 추천 |
|---|---|---|---|---|
| A. 현재 데이터로 제한 진행 + 7일 후보정 | BigQuery guard, 수동 검토, GA4 MP 제한 테스트 승인안을 지금 만든다 | 대기 시간 줄이고 72시간 신선도 문제를 줄인다 | 표본이 작아 자동 전환은 금지해야 한다 | 추천 |
| B. 7일 전까지 완전 대기 | 2026-05-04 이후만 판단한다 | 표본 안정성은 높다 | 과거 주문 GA4 MP 복구/세션 귀속 가치가 낮아질 수 있다 | 비추천 |

Codex 추천: A안. 자신감 86%.

낮춘 이유: BigQuery robust guard는 닫혔지만, confirmed 주문이 아직 11건이고 ambiguous 3건으로 비율이 높다. 단, 이 한계는 `자동 dispatcher 금지`의 이유이지 `1-2건 제한 테스트 승인안 준비 중단`의 이유는 아니다.

TJ님이 바로 YES/NO로 판단할 수 있는 제한 테스트 승인 문서는 [[npay-ga4-mp-limited-test-approval]]에 분리했다.

#### 7일 후보정 기준

7일치가 쌓이면 아래를 후보정한다.

| 후보정 대상 | 현재 기준 | 7일 후 확인 |
|---|---|---|
| A급 기준 | score >= 70, final/reconciled amount, time_gap <= 2분, score_gap >= 15 | A급 strong 비율이 50% 이상 유지되는지 |
| ambiguous 처리 | 전송 금지 | ambiguous 비율이 10% 이하로 내려가는지, 아니면 수동 검토 규칙을 추가할지 |
| clicked_no_purchase | 24시간 grace window 후 미구매 | 상품별/시간대별 패턴이 반복되는지 |
| GA4 guard | `already_in_ga4=robust_absent`만 제한 후보 | 7일 재실행에서도 후보 주문 100% 확인률 유지 여부 |
| 제한 전송 후보 | A급 + robust_absent + production_order | 7일 재실행에서도 같은 주문/패턴이 A급으로 남는지 |

주의: 7일 후보정은 `규칙 보정`과 `향후 전송 후보 조정`이다. 이미 광고 플랫폼으로 보낸 event를 쉽게 지우는 절차가 아니므로, 7일 전 실제 전송은 TJ가 별도 승인한 A급/robust_absent/production_order 최소 묶음으로만 진행해야 한다.

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

BigQuery에서 이미 GA4에 있는 주문을 확인한 뒤에는 아래처럼 guard 입력을 같이 넣는다. `ga4-present`에 들어간 ID는 전송 후보에서 제외된다. robust query로 두 ID가 모두 조회되지 않은 주문은 `ga4-robust-absent`에 Imweb `order_number`와 NPay `channel_order_no`를 모두 넣는다. 둘 중 하나라도 present면 `already_in_ga4=present`, 두 ID가 모두 robust query에서 조회되지 않아야 `already_in_ga4=robust_absent`가 된다.

```bash
cd backend
NPAY_INTENT_DB_PATH=/home/biocomkr_sns/seo/shared/backend-data/crm.sqlite3 \
npm exec tsx scripts/npay-roas-dry-run.ts -- \
  --start=2026-04-27T09:10:00.000Z \
  --end=2026-05-04T09:10:00.000Z \
  --ga4-present=<이미_GA4에_있는_order_number_또는_channel_order_no_쉼표목록> \
  --ga4-robust-absent=<GA4_robust_query에_없는_order_number_및_channel_order_no_쉼표목록> \
  --format=markdown
```

BigQuery 결과가 길면 파일로도 넣을 수 있다. 파일은 쉼표, 공백, 줄바꿈을 모두 구분자로 읽는다.

```bash
cd backend
NPAY_INTENT_DB_PATH=/home/biocomkr_sns/seo/shared/backend-data/crm.sqlite3 \
npm exec tsx scripts/npay-roas-dry-run.ts -- \
  --start=2026-04-27T09:10:00.000Z \
  --end=2026-05-04T09:10:00.000Z \
  --ga4-present-file=/tmp/npay_ga4_present_ids.txt \
  --ga4-robust-absent-file=/tmp/npay_ga4_robust_absent_ids.txt \
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
| `send_candidate` | A급 strong + already_in_ga4 robust_absent 또는 absent + production_order일 때만 Y |
| `block_reason` | 전송 금지 이유 |

현재 production A급 후보의 BigQuery 조회 대상 ID는 아래와 같다.

| Imweb order_number | NPay channel_order_no | 상태 |
|---|---|---|
| `202604280487104` | `2026042865542930` | BigQuery 확인 필요 |
| `202604285552452` | `2026042867285600` | BigQuery 확인 필요 |
| `202604303307399` | `2026043034982320` | BigQuery 확인 필요 |
| `202604309992065` | `2026043040116970` | BigQuery 확인 필요 |
| `202604302383065` | `2026043043205620` | 2026-04-30 21:23 KST GA4 MP 제한 테스트 전송 완료. 이후 BigQuery 수신 확인 필요 |

중요: 위 ID 중 하나라도 GA4 raw/purchase에 있으면 해당 주문은 `already_in_ga4=present`로 막는다. 두 ID가 모두 robust query에서 조회되지 않은 주문만 `already_in_ga4=robust_absent`가 되고 dispatcher dry-run 후보가 된다.

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
Generated: 2026-04-30 21:25 KST
Window: 2026-04-27 18:10:00 KST ~ 2026-04-30 21:25:25 KST
Freshness: VM snapshot `2026-04-30 21:19 KST`
Confidence: 89%

상세 표는 [[npay-roas-dry-run-20260430]]에 생성했다. 이 문서에는 최신 판단만 요약한다.

| 항목 | 값 |
|---|---:|
| live intent | 304 |
| confirmed NPay 주문 | 11 |
| strong_match | 8 |
| A급 strong | 6 |
| A급 production 후보 | 5 |
| B급 strong | 2 |
| ambiguous | 3 |
| purchase_without_intent | 0 |
| shipping_reconciled | 1 |
| dispatcher dry-run 후보 | 4 |
| 실제 GA4 MP 제한 전송 | 1 |
| Meta/TikTok/Google Ads 전송 | 0 |
| A급 production `robust_absent` | 4 |
| 이미 전송되어 차단한 주문 | `202604302383065` |

`product_idx_match`가 N/A인 이유는 `tb_iamweb_users` read model에 주문 상품의 아임웹 `product_idx`가 없다. 현재는 상품명과 금액을 기준으로만 본다.

`strong_match`도 원칙적으로 전송 금지다. 다만 TJ님이 `202604302383065` 1건만 GA4 MP 제한 테스트로 승인했고, 이 주문은 2026-04-30 21:23 KST에 전송했다. 나머지 A급 strong은 "향후 dispatcher dry-run 후보"라는 뜻이지, 승인 없이 GA4/Meta/TikTok/Google Ads로 보낸다는 뜻이 아니다. B급 strong과 ambiguous 3건은 첫 dispatcher 후보에서 제외한다.

TJ님 BigQuery robust query 결과 A급 production 후보 5건은 전송 전 `already_in_ga4=robust_absent`였다. 제한 테스트 이후 `202604302383065`은 운영 사실상 `present`로 막고, 남은 4건만 dry-run 후보로 둔다.

A급 기준은 `score >= 70`, `amount_match_type in (final_exact, shipping_reconciled, discount_reconciled, quantity_reconciled)`, `time_gap <= 2분`, `score_gap >= 15`다. B급 strong은 strong_match이지만 이 조건을 하나라도 만족하지 못한 주문이다.

### ambiguous 3건 원인 분해

Source: [[npay-roas-dry-run-20260430]]
Window: 2026-04-27 18:10 KST ~ 2026-04-30 19:10 KST
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

### clicked_no_purchase 209건 분해

Source: [[npay-roas-dry-run-20260430]]
Window: 2026-04-27 18:10 KST ~ 2026-04-30 21:25 KST
Definition: NPay 버튼 intent는 있지만 24시간 grace window 안에 confirmed NPay 주문 strong 매칭이 없는 건
Confidence: 86%. BigQuery와 주문 원장 지연 반영 가능성은 7일 재실행 때 다시 본다.

상품별 상위:

| product_idx | 상품 | clicked_no_purchase | 비중 |
|---|---|---:|---:|
| `97` | 바이오밸런스 90정 (1개월분) | 52 | 24.88% |
| `198` | 뉴로마스터 60정 (1개월분) | 38 | 18.18% |
| `317` | 혈당관리엔 당당케어 (120정) | 38 | 18.18% |
| `171` | 풍성밸런스 90정 (1개월분) | 19 | 9.09% |
| `386` | 메타드림 식물성 멜라토닌 함유 | 19 | 9.09% |
| `328` | 종합 대사기능&음식물 과민증 검사 Set | 18 | 8.61% |
| `300` | 영데이즈 저속노화 SOD 효소 (15포) | 15 | 7.18% |

광고키 조합별:

| ad_key_combo | clicked_no_purchase | 비중 |
|---|---:|---:|
| `gclid+fbp` | 180 | 86.12% |
| `fbp` | 19 | 9.09% |
| `fbclid+fbc+fbp` | 7 | 3.35% |
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

2026-05-01 BigQuery 재확인은 `202604309594732`와 `2026043044799490` 두 값을 모두 조회한다. 둘 중 하나라도 GA4 raw에 있으면 `already_in_ga4=present`로 두고 dispatcher 후보에서 제외한다. robust query에서 둘 다 없을 때만 `already_in_ga4=robust_absent` 또는 수동 테스트 라벨로 기록한다. 이 주문은 테스트 주문이라 robust_absent여도 전송 후보에서 제외한다.

현재 누적 dry-run amount 보정 집계:

Source: VM SQLite `npay_intent_log` snapshot `/tmp/seo-npay-roas-20260430.sqlite3`, 운영 Postgres `public.tb_iamweb_users` readonly
Window: 2026-04-27 18:10 KST ~ 2026-04-30 21:25 KST
Freshness: 2026-04-30 21:25 KST
Confidence: 86%. 아직 실제 7일치가 아니라 intent live publish 이후 약 72시간 누적이다.

| 항목 | 값 |
|---|---:|
| live intent | 304 |
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

### 진행률 근거

| 기준 | 상태 |
|---|---|
| 우리 기준 | 100%. NPay 외부 버튼 유지 원칙과 purchase 전송 금지 원칙을 문서화했다. |
| 운영 기준 | 100%. 운영 버튼은 제거하지 않았고 GTM intent-only 수집과 공존한다. |
| 100% 판단 이유 | 이 Sprint의 범위는 "버튼을 살릴지 말지" 결정하는 것이다. 버튼 유지로 닫혔고 후속 측정은 Phase2/3로 분리했다. |

### 완료한 것

- [x] [TJ+Codex] NPay 외부 주문형 버튼 유지 결론 확정 — 무엇: 상품 상세의 외부 NPay 주문형 버튼을 유지한다. 왜: 2026-04-01~2026-04-25 NPay 주문형 매출 17,905,200원, 전체 매출 4.65%라 제거 리스크가 있다. 어떻게: 기존 [[!npay]] 매출 근거와 버튼 클릭 intent 수집 결과를 대조했다. 산출물: 버튼 유지 원칙. 검증: 이 문서의 현재 결론과 Phase1 요약표가 `100% / 100%`로 표시된다.
- [x] [Codex] 버튼 클릭과 구매 전환의 의미를 분리 — 무엇: 버튼 클릭은 `npay_intent`, 구매는 confirmed NPay 주문으로만 본다. 왜: 버튼 클릭을 purchase로 보내면 ROAS가 부풀기 때문이다. 어떻게: NPay intent-only live publish와 dry-run 문서에 purchase 전송 금지를 명시했다. 산출물: 클릭 intent와 confirmed purchase 분리 원칙. 검증: report guardrail에 purchase 전송 금지가 있다.

### 남은 것

없음. 이 Sprint 범위는 원칙 결정까지다. 주문 매칭, 미결제자 분리, 전환 복구는 Phase2/Phase3에서 추적한다.

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

### 역할 구분

- TJ: 버튼 유지/제거의 사업 판단을 승인한다.
- Codex: NPay 클릭과 purchase 분리 원칙을 문서화하고 dry-run 로직에 반영한다.
- Claude Code: 해당 없음.

▲ [[#Phase-Sprint 요약표|요약표로]]

## Phase1-Sprint2

**이름**: 클릭 intent 장부

### 진행률 근거

| 기준 | 상태 |
|---|---|
| 우리 기준 | 100%. GTM tag 118 intent-only beacon과 백엔드 수신/중복 방어가 구현됐다. |
| 운영 기준 | 100%. live version에서 intent가 실제 저장되고 핵심 필드 채움률이 통과했다. |
| 100% 판단 이유 | 이 Sprint 범위는 "NPay 버튼 클릭 장부를 만든다"까지다. 주문 매칭과 purchase 전송은 Phase2/3다. |

### 완료한 것

- [x] [Codex] NPay 버튼 클릭 intent endpoint 연결 — 무엇: `POST /api/attribution/npay-intent`로 클릭 시점 정보를 저장한다. 왜: 결제 완료 후 biocom으로 자동 복귀하지 않아 client-side purchase가 빠질 수 있기 때문이다. 어떻게: GTM tag 118에서 `client_id`, `ga_session_id`, 상품 정보, 광고키를 beacon으로 보낸다. 산출물: `npay_intent_log`. 검증: 2026-04-30 21:25 KST 기준 live intent 304건.
- [x] [Codex] 핵심 필드 수집 품질 확인 — 무엇: `client_id`, `ga_session_id`, `product_idx` 채움률을 확인한다. 왜: 나중에 GA4 MP purchase 후보를 원래 세션에 붙이려면 세션키가 필요하다. 어떻게: VM SQLite snapshot과 protected API로 read-only 집계했다. 산출물: intent 수집 품질 표. 검증: 최근 24시간 핵심 필드 100%로 기록.
- [x] [Codex] purchase 미전송 guard 확인 — 무엇: intent 수집 단계에서는 GA4/Meta/TikTok/Google Ads purchase를 보내지 않는다. 왜: 버튼 클릭은 결제가 아니기 때문이다. 어떻게: GTM preview/live smoke test와 dispatcher log 0건을 확인했다. 산출물: intent-only guardrail. 검증: server purchase dispatch 0건.

### 남은 것

없음. TikTok 식별값(`ttclid`, `_ttp`) 보강은 이 Sprint가 아니라 Phase3-Sprint5의 남은 일로 둔다.

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

### 역할 구분

- TJ: 실결제 테스트와 GTM publish 승인 같은 사람 권한이 필요한 작업을 수행했다.
- Codex: endpoint, dedupe, dry-run 수집 품질 검증, 문서화를 담당했다.
- Claude Code: 해당 없음.

▲ [[#Phase-Sprint 요약표|요약표로]]

## Phase2-Sprint3

**이름**: 실제 주문 매칭

### 진행률 근거

| 기준           | 상태                                                                                |
| ------------ | --------------------------------------------------------------------------------- |
| 우리 기준        | 90%. read-only 매칭 로직, A/B 등급, ambiguous 원인 분해, 수동 검토 큐, BigQuery robust guard, dispatcher dry-run 후보 표시, B급/ambiguous 후속 해석까지 완료했고, 2026-05-05 운영 VM snapshot으로 7일+ window 재실행까지 완료했다. |
| 운영 기준        | 0%. DB `match_status` 업데이트, dispatcher, 광고 플랫폼 전송은 아직 열지 않았다.                     |
| 100%까지 남은 핵심 | A급 strong 10건의 GA4 BigQuery 중복 guard, B급/ambiguous 규칙 보강 여부 결정, DB `match_status` 적용 여부 별도 승인. |

### 완료한 것

- [x] [Codex] confirmed NPay 주문 원장 read model 정의 — 무엇: `operational_postgres.public.tb_iamweb_users`에서 confirmed NPay 주문을 주문 단위로 읽는다. 왜: 구매 확정은 버튼 클릭이 아니라 주문 원장이 정본이기 때문이다. 어떻게: 결제수단 NPay 계열, 취소/환불/미입금 제외, `order_number` 기준으로 집계했다. 산출물: read-only order model. 검증: 2026-04-30 19:07 KST dry-run 기준 confirmed NPay 주문 11건.
- [x] [Codex] `channel_order_no`를 dry-run에 추가 — 무엇: Imweb `order_number`와 NPay `channel_order_no`를 둘 다 들고 간다. 왜: BigQuery 또는 NPay 완료 URL에는 Imweb 주문번호가 아니라 NPay 채널 주문번호가 찍힐 수 있기 때문이다. 어떻게: `tb_iamweb_users.raw_data.channelOrderNo`를 읽어 리포트에 표시한다. 산출물: BigQuery 조회 ID 목록. 검증: A급 production 후보 5건이 `order_number + channel_order_no` 쌍으로 출력된다.
- [x] [Codex] A급/B급 strong 기준 구현 — 무엇: `score`, `amount_match_type`, `time_gap`, `score_gap` 기준으로 A/B를 나눈다. 왜: strong_match라도 금액이나 시간 근거가 약하면 첫 dispatcher 후보에서 빼야 한다. 어떻게: `backend/src/npayRoasDryRun.ts`의 `classifyStrongGrade`와 테스트를 수정했다. 산출물: A급 6건, B급 2건. 검증: `node --import tsx --test tests/npay-roas-dry-run.test.ts`.
- [x] [Codex] ambiguous 3건 원인 분해 — 무엇: 자동 전송 위험 사유를 reason별로 나눈다. 왜: 애매한 주문을 purchase로 보내면 attribution이 틀린다. 어떻게: 후보 수, 같은 상품 반복 클릭, 점수차, 금액 조정 실패, member key 부재를 표로 집계했다. 산출물: `Ambiguous Reason Breakdown`. 검증: 3건 모두 `low_score_gap`, `multiple_intents_same_product`, `same_product_multiple_clicks`, `no_member_key`로 표시된다.
- [x] [Codex] 7일 전 조기 진행안 확정 — 무엇: 7일치를 기다리기만 하지 않고 현재 304 intent/11 주문 표본으로 먼저 할 일을 분리했다. 왜: GA4 MP는 과거 이벤트/세션 귀속에 시간 제약이 있어 7일 후 일괄 복구는 가치가 떨어질 수 있다. 어떻게: BigQuery guard, B급/ambiguous 수동 검토, GA4 MP 제한 테스트 승인안은 지금 진행하고 자동 dispatcher는 7일 후보정 후로 나눴다. 산출물: [[#7일 전 조기 진행 + 7일 후보정 방안]]. 검증: 실제 전송 금지선과 후보정 기준이 표로 분리됐다.
- [x] [Codex] B급 strong 2건과 ambiguous 3건 수동 검토 큐 작성 — 무엇: `202604283756893`, `202604303298608`, ambiguous 3건의 금액/상품/시간 후보를 사람이 볼 수 있게 요약했다. 왜: 자동 제외가 맞는지 확인해야 dispatcher 후보 누락도 줄일 수 있다. 어떻게: `Top Candidate Intents`에서 best/second 후보, amount reason, cart 가능성을 별도 표로 뽑았다. 산출물: [[npay-roas-dry-run-20260430]] `Manual Review Queue`. 검증: 각 주문에 `전송 금지`와 다음 검토 액션이 표시된다.
- [x] [TJ+Codex] A급 production 후보 5건의 BigQuery robust guard 반영 — 무엇: A급 후보 5건의 Imweb `order_number`와 NPay `channel_order_no` 총 10개 ID를 GA4 raw/purchase 전체에서 확인했다. 왜: 이미 GA4에 있는 주문을 Measurement Protocol로 다시 보내면 매출이 중복된다. 어떻게: TJ님 robust query 결과 "표시할 데이터 없음"을 `--ga4-robust-absent` 입력값으로 넣고 dry-run을 재실행했다. 산출물: `already_in_ga4=robust_absent` 5건. 검증: [[npay-roas-dry-run-20260430]] summary의 `already_in_ga4_lookup_robust_absent=5`.
- [x] [Codex] dispatcher dry-run 후보 표시 — 무엇: A급 strong + production_order + manual_test_order 아님 + `robust_absent`인 주문을 payload 후보로 표시했다. 왜: 실제 전송 전 후보 주문, 세션키, value, event_id, dedupe key를 검토해야 한다. 어떻게: `backend/src/npayRoasDryRun.ts`와 CLI/API 입력값에 `robust_absent` 상태를 추가했다. 산출물: `Dispatcher Dry-run Log`의 `send_candidate=Y` 후보. 검증: `202604302383065` 전송 후에는 `already_in_ga4=present`로 차단되어 남은 후보가 4건으로 표시된다.
- [x] [Codex] B급/ambiguous 5건 후속 원인 분석 — 무엇: B급 strong 2건과 ambiguous 3건을 주문별로 다시 분해했다. 왜: 자동 제외가 맞는지, 아니면 규칙 보강으로 살릴 수 있는지 판단해야 한다. 어떻게: 금액 불일치, 같은 상품 반복 클릭, score_gap, member key 부재, cart 가능성을 주문별로 적었다. 산출물: [[npay-phase2-followup-20260430]]. 검증: 5건 모두 첫 dispatcher 전송 금지로 유지된다.
- [x] [Codex] 운영 VM snapshot으로 2026-05-05 재실행 — 무엇: 운영 VM `npay_intent_log` snapshot을 로컬로 가져와 confirmed NPay 주문과 다시 매칭했다. 왜: 로컬 DB 0건 기준으로 unmatched 결론을 내리면 오판이기 때문이다. 어떻게: VM SQLite를 read-only backup으로 복사하고 `NPAY_INTENT_DB_PATH=backend/data/vm-npay-intent-20260505.sqlite3`로 dry-run을 실행했다. 산출물: [[npay-roas-dry-run-vm-snapshot-20260505]]. 검증: live intent 820건, confirmed NPay 주문 30건, strong match 20건, A급 10건, purchase_without_intent 0건.
- [x] [Codex] source 접근 불가 상태 해소 — 무엇: 토큰 원문을 노출하지 않고 VM SQLite snapshot으로 운영 source를 읽었다. 왜: `.env` 토큰을 채팅/문서에 남기면 보안 위험이 있기 때문이다. 어떻게: SSH `taejun` 계정과 sudo read-only snapshot을 사용했다. 산출물: local snapshot과 dry-run markdown. 검증: SQLite integrity check PASS, snapshot `npay_intent_log` 823건.

### 남은 것

- [ ] [Codex] B급/ambiguous 후속 판단을 7일 후보정 때 반영한다 — 무엇: 현재 수동 검토 큐의 5건을 7일 window에서 다시 보고 `전송 제외 유지`, `규칙 보강`, `운영 원장 추가 확인`으로 나눈다. 왜: 현재는 제외 판단은 가능하지만 규칙 보강을 확정하기에는 아직 이르기 때문이다. 어떻게: 2026-05-04 이후 같은 리포트를 재실행하고, 동일 주문/동일 패턴 반복 여부와 amount reason 변화를 비교한다. 산출물: 7일 후보정 manual review decision. 검증: ambiguous 비율 10% 이하 여부와 B급 재분류 여부가 표시된다. 의존성: 2026-05-04 18:10 KST 이후 가능.
- [ ] [Codex] A급 strong 10건의 GA4 BigQuery guard 확인 — 무엇: `order_number`와 `channel_order_no` 20개 ID가 GA4 raw/purchase에 이미 있는지 확인한다. 왜: 이미 있는 주문을 GA4 MP나 광고 플랫폼으로 다시 보내면 매출이 중복된다. 어떻게: GA4 BigQuery robust query로 ecommerce transaction_id, event_params transaction_id, event_params value 범위를 모두 조회한다. 산출물: `present`, `robust_absent`, `unknown` 분류. 검증: dispatcher 후보 주문의 `already_in_ga4` 확인률 100%.

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

dispatcher dry-run은 `already_in_ga4` guard를 반드시 본다. BigQuery에서 같은 `transaction_id`가 GA4 purchase 또는 raw event로 이미 존재하면 `already_in_ga4=present`로 표시하고 전송 후보에서 제외한다. BigQuery 확인이 아직 안 된 주문은 `already_in_ga4=unknown`으로 두고 역시 전송 후보에서 제외한다. `robust_absent`는 Imweb `order_number`와 NPay `channel_order_no`가 ecommerce transaction_id, event_params transaction_id, event_params 전체 value 범위에서 모두 조회되지 않은 상태다.

### 산출물

| 산출물 | 설명 |
|---|---|
| matched 리포트 | intent와 주문이 확실히 붙은 건 |
| clicked_no_purchase 리포트 | 버튼은 눌렀지만 주문이 없는 건 |
| purchase_without_intent 리포트 | NPay 주문은 있는데 intent가 없는 건 |
| ambiguous 리포트 | 후보가 여러 개라 구매 전송하면 위험한 건 |

### 역할 구분

- TJ: BigQuery 권한 또는 조회 결과 제공, Phase3 진입 승인.
- Codex: read-only 매칭 로직, 7일치 재실행, BigQuery guard 적용, 승인안 작성.
- Claude Code: 필요 시 리포트 UI/시각화 보조. 현재는 해당 없음.

▲ [[#Phase-Sprint 요약표|요약표로]]

## Phase2-Sprint4

**이름**: 미결제자 분리

### 진행률 근거

| 기준 | 상태 |
|---|---|
| 우리 기준 | 82%. `clicked_no_purchase` 정의, 2026-05-05 VM snapshot 기준 709건의 상품/광고키/시간대 분해, 운영 해석 표까지 작성했다. |
| 운영 기준 | 0%. 리마케팅 대상 전송, 운영 대시보드 반영, 자동 액션은 아직 하지 않았다. |
| 100%까지 남은 핵심 | GA4 BigQuery guard 반영 후 이탈 분해 후보정, 리마케팅 사용 여부 승인, 운영 대시보드 반영 여부 결정. |

### 완료한 것

- [x] [Codex] `clicked_no_purchase` 상태 정의 — 무엇: NPay 버튼 intent는 있지만 24시간 grace window 안에 confirmed NPay 주문 strong 매칭이 없는 건으로 정의했다. 왜: 버튼 클릭자를 구매자로 오인하지 않기 위해서다. 어떻게: intent result status를 `clicked_purchased_candidate`, `clicked_no_purchase`, `intent_pending`으로 분리했다. 산출물: intent status 분류. 검증: 2026-05-05 VM snapshot 기준 `clicked_no_purchase=709`, `intent_pending=91`.
- [x] [Codex] 상품별 미결제 클릭 분해 — 무엇: 209건을 product_idx/product_name 기준으로 나눴다. 왜: 어떤 상품에서 결제창 진입 후 이탈이 큰지 봐야 UX와 가격/배송비를 점검할 수 있다. 어떻게: `npay_intent_log.product_idx`, `product_name`으로 read-only 집계했다. 산출물: By Product 표. 검증: 바이오밸런스 52건, 뉴로마스터 38건, 당당케어 38건이 상위로 표시된다.
- [x] [Codex] 광고키 조합별 미결제 클릭 분해 — 무엇: 209건을 `gclid/fbp/fbc/fbclid/gbraid/wbraid` 조합으로 나눴다. 왜: 결제 이탈이 Google/Meta 어느 유입에서 집중되는지 봐야 한다. 어떻게: intent row의 광고키 존재 여부를 조합 문자열로 변환했다. 산출물: By Ad Key 표. 검증: `gclid+fbp` 180건, 86.12%로 표시된다.
- [x] [Codex] KST 시간대별 미결제 클릭 분해 — 무엇: 209건을 KST hour 기준으로 나눴다. 왜: 특정 시간대 결제창 또는 광고 유입 품질 문제가 있는지 보기 위해서다. 어떻게: UTC captured_at을 KST로 변환해 시간대별 집계했다. 산출물: By KST Hour 표. 검증: 2026-04-28 12:00 KST 20건 등 피크가 보인다.
- [x] [Codex] 현재 표본 기반 조기 해석 가능 범위 정의 — 무엇: 209건 표본으로 지금 볼 수 있는 것과 7일 뒤 후보정해야 할 것을 나눴다. 왜: 이탈 데이터가 이미 쌓였는데 7일 전까지 아무 해석도 하지 않으면 개선이 늦다. 어떻게: 현재는 상품/광고키/시간대 가설을 만들고, 리마케팅 audience 전송은 7일 후보정 후 승인으로 분리했다. 산출물: [[#7일 전 조기 진행 + 7일 후보정 방안]]. 검증: 미결제 클릭은 purchase 전송 대상이 아니라는 금지선이 유지된다.
- [x] [Codex] 현재 표본 기준 운영 해석 표 작성 — 무엇: 상위 상품과 광고키별 원인을 `가격/배송비`, `상품 상세`, `결제 UX`, `광고 유입 품질`로 나눴다. 왜: 숫자만으로는 운영팀이 다음 액션을 정하기 어렵기 때문이다. 어떻게: 상위 상품 6개와 광고키 조합을 운영 가설로 정리했다. 산출물: [[npay-phase2-followup-20260430]]. 검증: 각 항목이 purchase 전송 금지와 운영 점검 액션으로 분리된다.
- [x] [Codex] 2026-05-05 VM snapshot 기준 미결제 클릭 재분해 — 무엇: 709건을 상품/광고키/시간대 기준으로 다시 나눴다. 왜: 2026-04-30의 209건보다 운영 표본이 커졌으므로 우선순위가 더 안정적이다. 어떻게: [[npay-roas-dry-run-vm-snapshot-20260505]]의 `Clicked No Purchase Breakdown`을 생성했다. 산출물: 상위 상품은 당당케어 189건, 바이오밸런스 134건, 뉴로마스터 113건이다. 검증: `gclid+fbp` 조합이 633건, 89.28%로 표시된다.

### 남은 것

- [ ] [Codex] GA4 guard 반영 후 `clicked_no_purchase` 후보정 — 무엇: A급 strong 10건이 GA4에 이미 있는지 확인한 뒤 709건 분해를 다시 계산한다. 왜: 실제 구매로 확인된 intent를 clicked_no_purchase에 남기면 결제 이탈이 과장될 수 있기 때문이다. 어떻게: BigQuery guard 결과를 dry-run 입력값에 넣고 markdown 리포트를 재생성한다. 산출물: guard 반영 후 상품/광고키/시간대 후보정 표. 검증: `clicked_no_purchase / 전체 intent` 이탈률과 상위 상품 순위가 표시된다.
- [ ] [TJ+Codex] 리마케팅 사용 여부 결정 — 무엇: `clicked_no_purchase`를 Meta/TikTok/Google 리마케팅 audience로 쓸지 결정한다. 왜: 미구매자는 구매 전환이 아니므로 purchase로 보내면 안 되지만, 리마케팅 대상이 될 수 있다. 어떻게: Codex가 추천안 A/B를 만들고 TJ가 `YES/NO`로 승인한다. 산출물: 리마케팅 승인안. 검증: 사용 채널, 보관 기간, 제외 조건이 문서화된다. 의존성: 7일치 재집계 후 권장.

### 왜 중요한가

버튼을 눌렀지만 결제하지 않은 사람은 구매자가 아니다. 이들을 구매로 보내면 GA4, Meta, TikTok ROAS가 부풀고 광고 최적화가 잘못된다.

하지만 이들은 버릴 데이터도 아니다. 장바구니 이탈, 결제 이탈, 리마케팅 대상이 될 수 있다.

### 상태 전환

| 기준 | 상태 |
|---|---|
| intent 생성 직후 | `intent_pending` |
| intent 이후 24시간 안에 confirmed NPay 주문 strong 매칭 | `clicked_purchased_candidate` |
| strong_match이고 A급 조건 충족, `already_in_ga4=robust_absent` 또는 `absent` | dispatcher dry-run 후보 |
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

### 역할 구분

- TJ: 미결제 클릭을 리마케팅에 쓸지 승인한다.
- Codex: read-only 분해 리포트, 7일치 재집계, 원인 가설 표를 작성한다.
- Claude Code: 리포트 UI가 필요해질 때 시각화 보조. 현재는 해당 없음.

▲ [[#Phase-Sprint 요약표|요약표로]]

## Phase3-Sprint5

**이름**: GA4/Meta/TikTok 전환 복구

### 진행률 근거

| 기준 | 상태 |
|---|---|
| 우리 기준 | 55%. 전환 복구 원칙, payload preview, robust_absent guard, GA4 MP 제한 테스트 승인안, 승인된 1건 수동 전송까지 완료했다. |
| 운영 기준 | 5%. GA4 MP purchase 1건만 제한 테스트로 전송했다. Meta/TikTok/Google Ads purchase 전송은 아직 0건이다. |
| 100%까지 남은 핵심 | BigQuery 수신 확인, 7일 후보정, Meta CAPI 제한 테스트, TikTok 식별값 보강, Google Ads 별도 승인. |

### 완료한 것

- [x] [Codex] 전환 복구 원칙 정리 — 무엇: 광고 플랫폼에는 confirmed purchase만 보낸다는 원칙을 세웠다. 왜: 버튼 클릭을 구매로 보내면 ROAS가 틀어진다. 어떻게: Phase3 조건과 전송 금지 조건을 문서화했다. 산출물: 플랫폼별 처리 표. 검증: `intent_pending`, `clicked_no_purchase`, `ambiguous`, B급 strong, `already_in_ga4=unknown`이 모두 전송 금지로 표시된다.
- [x] [Codex] GA4 payload preview 초안 작성 — 무엇: `NPayRecoveredPurchase_{order_number}` event_id와 client/session/value 후보를 리포트에 표시한다. 왜: 전송 전에 payload 품질을 눈으로 확인해야 한다. 어떻게: dispatcher dry-run log에 preview를 만들고, 전송 스크립트는 `--mode=send --confirm-order`가 있어야만 작동하게 했다. 산출물: `Dispatcher Dry-run Log`, `backend/scripts/npay-ga4-mp-limited-test.ts`. 검증: 승인 주문 외 전송 불가.
- [x] [Codex] GA4 MP 신선도 리스크 반영 — 무엇: 7일 대기만 할 경우 과거 이벤트/세션 귀속 품질이 떨어질 수 있음을 계획에 반영했다. 왜: Google 공식 문서상 과거 timestamp와 session attribution에 시간 제약이 있기 때문이다. 어떻게: 현재 표본으로 제한 테스트 승인안은 먼저 만들고, 자동/대량 전송은 7일 후보정 후로 분리했다. 산출물: [[#7일 전 조기 진행 + 7일 후보정 방안]]. 검증: 실제 전송은 여전히 TJ 승인 전 금지다.
- [x] [Codex] GA4 MP 제한 테스트 승인안 작성 — 무엇: robust_absent A급 production 후보 5건 중 수동 제한 전송 후보 1-2건을 고르는 승인안을 만들었다. 왜: 자동 dispatcher가 아니라 최소 범위로 GA4 MP 수신과 BigQuery 반영을 검증해야 하기 때문이다. 어떻게: 후보별 `event_id`, `transaction_id`, `channel_order_no`, `client_id`, `ga_session_id`, `timestamp_micros`, dedupe key, 72시간 리스크를 표로 정리했다. 산출물: [[npay-ga4-mp-limited-test-approval]]. 검증: 승인 문서 안에서도 실제 전송 금지와 `YES/NO` 결정이 분리된다.
- [x] [TJ+Codex] GA4 MP 1건 제한 테스트 실행 — 무엇: `202604302383065` 1건만 GA4 MP `purchase`로 전송했다. 왜: NPay return 누락 주문을 GA4 raw에 복구할 수 있는지 확인하기 위해서다. 어떻게: dry-run guard 통과, GA4 debug validation 0건 확인 후 collect endpoint에 1회 전송했다. 산출물: [[npay-ga4-mp-limited-test-result-20260430]], [[npay-ga4-mp-limited-test-result-20260430.json]]. 검증: collect HTTP 204, 이후 dry-run에서 이 주문은 `already_in_ga4=present`로 차단된다.

### 남은 것

- [ ] [TJ+Codex] GA4 MP 1건 BigQuery 수신 확인 — 무엇: `202604302383065`, `2026043043205620`, `NPayRecoveredPurchase_202604302383065`가 GA4 raw export에 들어왔는지 확인한다. 왜: collect 204는 수신 성공 신호지만 BigQuery raw 반영을 별도로 봐야 한다. 어떻게: [[npay-ga4-mp-limited-test-result-20260430]]의 검증 쿼리를 실행한다. 산출물: present/absent 결과. 검증: 결과가 보이면 `already_in_ga4=present` 유지, 안 보이면 지연/누락 원인 분석.
- [ ] [Codex] Meta CAPI 제한 테스트 준비 — 무엇: `fbp`, `fbc/fbclid`가 있는 A급 후보만 Meta CAPI 후보로 분리한다. 왜: Meta는 브라우저 식별값 품질이 없으면 매칭률이 낮다. 어떻게: dispatcher preview에 Meta 식별키 presence와 event_id dedup 기준을 추가한다. 산출물: Meta CAPI dry-run payload 표. 검증: 테스트 전송 전까지 실제 CAPI 호출 0건. 의존성: GA4 MP 테스트 설계 후.
- [ ] [Codex] TikTok 식별값 보강 승인안 작성 — 무엇: `ttclid`, `_ttp`, TikTok UTM을 NPay intent에 추가할지 검토한다. 왜: 현재 v1 intent는 TikTok attribution을 안정적으로 복구하기 어렵다. 어떻게: GTM payload, DB column, API request body 변경 범위를 산정한다. 산출물: TikTok 식별값 보강 승인안. 검증: 스키마 변경 필요 여부와 TJ 승인 포인트가 분리된다. 의존성: 병렬가능, DB 변경은 승인 전 금지.
- [ ] [TJ] 실제 전송 순서 승인 — 무엇: GA4, Meta, TikTok, Google Ads 중 어떤 순서로 live 전송을 열지 결정한다. 왜: 광고 플랫폼 학습 신호가 바뀌므로 사업 승인 필요하다. 어떻게: Codex 승인안에 `YES/NO`로 답한다. 산출물: 단계별 전송 승인. 검증: 승인 전까지 purchase 전송 0건. 의존성: 선행필수.

### 원칙

광고 플랫폼에는 `confirmed purchase`만 보낸다. 버튼 클릭 intent는 구매 전환으로 보내지 않는다.

### 플랫폼별 처리

| 플랫폼 | 보낼 이벤트 | 조건 | 현재 판단 |
|---|---|---|---|
| GA4 | Measurement Protocol `purchase` | A급 strong, `already_in_ga4=robust_absent`, 테스트 주문 아님 | 제한 테스트 승인안 작성 완료. 실제 전송은 TJ YES 필요 |
| Meta | CAPI `Purchase` | A급 strong, `fbp` 또는 `fbc/fbclid` 있음, `already_in_ga4=robust_absent` | GA4 제한 테스트 후 승인 |
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
| `already_in_ga4=absent` 단순 확인 | 조회 범위가 약하면 누락일 수 있어 robust query 전까지 보류 |
| `test_order` | 검증용 결제라 광고 최적화에 보내면 안 된다 |
| 중복 dispatch 기록 있음 | 같은 주문을 두 번 보낼 수 있다 |

### 역할 구분

- TJ: 실제 광고 플랫폼 전송 승인, 계정/권한이 필요한 외부 설정 승인.
- Codex: GA4/Meta/TikTok/Google Ads payload dry-run, 중복 guard, 승인안 작성.
- Claude Code: 운영자가 볼 리포트 UI가 필요해질 때 화면 보조. 현재는 해당 없음.

▲ [[#Phase-Sprint 요약표|요약표로]]

## Phase3-Sprint6

**이름**: 운영 리포트와 승인 기준

### 진행률 근거

| 기준 | 상태 |
|---|---|
| 우리 기준 | 80%. 매일 봐야 할 숫자, Go 기준, BigQuery robust guard 반영 리포트, GA4 MP 제한 테스트 결과, 7일 후보정 리포트 템플릿을 분리했다. |
| 운영 기준 | 0%. 운영 대시보드/자동 알림/정기 리포트 배포는 아직 없다. |
| 100%까지 남은 핵심 | GA4 MP 제한 테스트 BigQuery 수신 확인, 7일 후보정 결과 반영, 운영자가 보는 요약 화면 또는 정기 markdown 배포 여부 확정. |

### 완료한 것

- [x] [Codex] 운영 지표 목록 정의 — 무엇: intent 수, confirmed NPay 주문, A/B strong, ambiguous, clicked_no_purchase, purchase_without_intent 등을 정했다. 왜: 매일 같은 기준으로 봐야 개선/악화를 판단할 수 있다. 어떻게: Phase3-Sprint6 지표 표에 정리했다. 산출물: 매일 봐야 할 숫자 목록. 검증: 지표마다 의미가 문서화되어 있다.
- [x] [Codex] Go 기준 초안 작성 — 무엇: A급 strong 비율, ambiguous 비율, purchase_without_intent 비율, `already_in_ga4` 확인률 기준을 만들었다. 왜: 전송 여부를 감으로 판단하지 않기 위해서다. 어떻게: 현재 표본 기준으로 보수적 기준을 잡았다. 산출물: Go 기준 표. 검증: 7일 리포트가 나오면 각 항목을 pass/fail로 판정할 수 있다.
- [x] [Codex] 조기 진행/후보정 운영 기준 추가 — 무엇: 현재 표본으로 할 수 있는 일과 7일 뒤에만 닫을 일을 분리했다. 왜: 7일 전까지 아무것도 하지 않으면 복구 속도가 늦고, 반대로 바로 대량 전송하면 오매칭 위험이 크다. 어떻게: 조기 진행은 read-only/승인안/BigQuery guard로 제한하고, 7일 후보정은 자동 dispatcher 기준 확정으로 정의했다. 산출물: 조기 진행 + 후보정 표. 검증: 자동 dispatcher와 광고 전송 금지선이 유지된다.
- [x] [Codex] 현재 표본 기반 승인 패키지 작성 — 무엇: 304 intent/11 confirmed order 기준으로 BigQuery guard, A급 후보, 전송 금지 조건, GA4 MP 제한 테스트 여부를 한 장으로 요약했다. 왜: TJ가 7일 전에도 `YES: 제한 테스트` 또는 `NO: 7일 후보정까지 대기`로 판단할 수 있어야 한다. 어떻게: A급 production 후보 5건, robust_absent guard 상태, ambiguous 3건, clicked_no_purchase 209건을 표로 묶었다. 산출물: [[npay-early-phase2-approval-20260430]], [[npay-ga4-mp-limited-test-approval]], [[npay-phase2-followup-20260430]]. 검증: 실제 전송 범위와 금지선이 분리된다.
- [x] [Codex] 7일치 후보정 리포트 템플릿 확정 — 무엇: 2026-05-04 이후 매번 같은 항목이 나오는 markdown 템플릿을 고정했다. 왜: 사람이 매번 해석하면 느리고 기준이 흔들린다. 어떻게: `npay-roas-dry-run` 출력에 summary, BigQuery IDs, dispatcher preview, clicked_no_purchase breakdown, manual review queue를 유지한다. 산출물: [[npay-roas-dry-run-20260430]]. 검증: Phase2 성공 기준 4개가 한 화면에서 보인다.
- [x] [Codex] 운영 요약 링크 정리 — 무엇: `!npayroas.md` 상단에 최신 리포트와 BigQuery 조회 대상 링크를 고정했다. 왜: TJ와 팀이 문서 내부를 뒤지지 않고 현재 상태를 찾게 하기 위해서다. 어떻게: 관련 문서 링크에 최신 리포트와 승인안을 추가하고, BigQuery 조회 대상은 승인안으로 분리했다. 산출물: 운영용 문서 네비게이션. 검증: 상단 관련 문서에서 최신 dry-run과 승인안으로 바로 이동할 수 있다.
- [x] [Codex] BigQuery guard 결과 반영 리포트 작성 — 무엇: TJ robust query 결과를 `robust_absent` 상태로 반영했다. 왜: `unknown` 상태에서는 제한 테스트 후보가 0건이기 때문이다. 어떻게: 10개 ID를 `--ga4-robust-absent`로 넣고 dry-run을 재실행했다. 산출물: [[npay-roas-dry-run-20260430]] dispatcher dry-run log. 검증: `202604302383065` 전송 후에는 `already_in_ga4=present`, 남은 `send_candidate=Y` 4건으로 표시된다.

### 남은 것

- [ ] [Claude Code] 필요 시 운영 화면 초안 제작 — 무엇: markdown 리포트가 너무 길면 `clicked_no_purchase`, A급 후보, BigQuery 상태만 보는 간단 화면을 만든다. 왜: 운영팀이 매일 보기에는 긴 MD가 비효율적일 수 있다. 어떻게: 기존 admin/dashboard 패턴을 재사용해 read-only table을 만든다. 산출물: UI 초안. 검증: 화면에서 주문번호/상태/block reason이 보인다. 의존성: TJ가 화면 필요성을 승인하면 진행.
- [ ] [TJ+Codex] GA4 MP 제한 테스트 BigQuery 수신 확인 — 무엇: 이미 보낸 `202604302383065` 1건이 GA4 raw export에 들어왔는지 확인한다. 왜: collect HTTP 204만으로 리포트 반영까지 닫힌 것은 아니기 때문이다. 어떻게: [[npay-ga4-mp-limited-test-result-20260430]]의 검증 쿼리로 `order_number`, `channel_order_no`, `event_id`를 조회한다. 산출물: present/absent 결과. 검증: 결과가 나오면 이 문서와 dry-run guard를 갱신한다.

### 매일 봐야 할 숫자

| 지표 | 의미 |
|---|---|
| NPay intent 수 | 버튼 클릭 시도 |
| confirmed NPay 주문 수 | 실제 NPay 결제 |
| clicked_purchased_candidate 수 | 클릭과 주문이 strong 후보로 붙은 구매 |
| A급 strong 수 | 첫 dispatcher dry-run 후보가 될 수 있는 주문 |
| B급 strong 수 | strong이지만 첫 dispatcher 후보에서 제외할 주문 |
| already_in_ga4 present 수 | 중복 전송 차단 주문 |
| already_in_ga4 robust_absent 수 | 제한 테스트 후보가 될 수 있는 중복 미수신 주문 |
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
| 1 | Codex | 현재 표본 승인 패키지를 만든다 | 이미 304 intent/11 주문이 있어 조기 판단이 가능하다 | A급 후보, robust_absent guard, ambiguous, clicked_no_purchase를 한 장으로 요약 | 현재 표본 승인안 |
| 2 | TJ | dispatcher 후보 주문의 BigQuery 존재 여부를 확인한다 | 이미 GA4에 있는 주문을 MP로 다시 보내면 중복이다 | `order_number`와 `channel_order_no`를 purchase와 전체 event_name 기준으로 조회 | robust_absent ID 목록 |
| 3 | Codex | BigQuery guard가 반영된 dispatcher dry-run을 만든다 | purchase 전송 전에 중복과 금액 오류를 막는다 | A급 strong + already_in_ga4=robust_absent만 payload 후보로 표시 | dry-run dispatch log |
| 4 | TJ + Codex | GA4 MP 제한 테스트 1건을 검증한다 | 이미 `202604302383065` 1건을 보냈으므로 수신 여부를 닫아야 한다 | BigQuery에서 `transaction_id`, `channel_order_no`, `event_id`를 조회 | 수신 확인 결과 |
| 5 | Codex | 2026-05-04 18:10 KST 이후 7일 dry-run으로 후보정한다 | 현재 표본은 조기 판단용이고 자동 dispatcher 기준은 7일치로 안정화해야 한다 | `--start=2026-04-27T09:10:00.000Z --end=2026-05-04T09:10:00.000Z` | 7일 후보정 리포트 |
| 6 | Codex | TikTok 식별값 수집 보강안을 만든다 | TikTok ROAS는 현재 v1 필드만으로 부족하다 | `ttclid`, `_ttp`, TikTok UTM 추가 범위 산정 | 승인안 |

▲ [[#Phase-Sprint 요약표|요약표로]]

## Codex 추천

추천은 `네이버페이 외부 버튼 유지 + 현재 표본 기반 제한 진행 + 7일 후보정`이다.

자신감은 86%다. 버튼 클릭 intent 수집 품질은 이미 운영에서 통과했고 현재 304 intent/11 주문 표본으로 A급 후보와 robust_absent 후보가 나왔으며, 승인된 GA4 MP 1건 전송도 204로 끝났다. 다만 ambiguous 비율이 아직 높고 confirmed 주문이 11건뿐이므로, 자동 dispatcher는 바로 열지 않는 것이 맞다.

## TJ 결정 필요

지금 당장 TJ님이 새로 결정할 것은 없다. `YES: GA4 MP 1건 제한 테스트`는 이미 승인했고, Codex가 `202604302383065` 1건 전송까지 완료했다.

다음 TJ 확인 항목은 BigQuery 수신 결과다.

| 확인 | 의미 | Codex 추천 |
|---|---|---|
| BigQuery에 `202604302383065`이 보임 | GA4 MP 제한 테스트 수신 확인 | `already_in_ga4=present` 유지, 7일 후보정까지 대량 전송 금지 |
| BigQuery에 아직 안 보임 | export 지연 또는 수신 누락 가능성 | 2026-05-01 오전 재조회 후 판단 |

다음 Codex 작업은 2026-05-04 18:10 KST 이후 7일치 후보정이다.
