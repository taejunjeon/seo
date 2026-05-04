# 월별 채널 매출 주문·결제 조인 키 매트릭스

작성 시각: 2026-05-04 17:45 KST
기준일: 2026-05-04
대상: biocom 우선. 이후 thecleancoffee, aibio, coffeevip로 확장.
문서 성격: Green Lane read-only 설계 문서. 운영 DB write, GTM 운영 게시, 광고 플랫폼 전환 송출은 하지 않았다.

```yaml
harness_preflight:
  common_harness_read:
    - AGENTS.md
    - CLAUDE.md
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
    - docurule.md
  project_harness_read:
    - harness/npay-recovery/README.md
    - harness/npay-recovery/RULES.md
    - harness/npay-recovery/VERIFY.md
    - harness/npay-recovery/APPROVAL_GATES.md
    - harness/gdn/README.md
    - harness/gdn/RULES.md
    - harness/gdn/VERIFY.md
  required_context_docs:
    - total/!total.md
    - total/source-inventory-20260504.md
    - data/!datacheckplan.md
    - naver/!npayroas.md
    - meta/meta-roas-gap-confirmation-runbook-20260504.md
  lane: Green
  allowed_actions:
    - read-only source 조사
    - 로컬 파일/코드 열람
    - 운영 DB SELECT
    - 외부 API read-only 조회
    - 문서 작성
  forbidden_actions:
    - 운영 DB write/import/update
    - GTM 운영 게시
    - 광고 플랫폼 전환 송출
    - CAPI dispatcher 실행
    - backend 운영 반영
    - Imweb header/footer 수정
  source_window_freshness_confidence:
    source: "backend/src/orderKeys.ts, 운영 Postgres information_schema SELECT, 로컬 SQLite schema, source inventory"
    window: "2026-05-04 17:45 KST 조사 시점"
    freshness: "운영 Toss/Imweb과 Attribution VM은 fresh. 로컬 SQLite mirror는 stale. biocom GA4 BigQuery raw는 permission denied."
    confidence: 0.9
```

## 10초 결론

월별 채널 매출을 정확히 나누려면 `주문·결제 정본 키`와 `유입 증거 키`를 섞으면 안 된다.

돈의 정본은 `payment_key`, `order_id`, `order_number`로 만든다. 광고 유입 정본은 `fbclid`, `gclid`, `ttclid`, UTM, referrer, `ga_session_id`로 붙인다. 광고 키가 있어도 실제 결제 주문과 붙지 않으면 매출로 확정하지 않는다.

첫 dry-run은 운영 Postgres의 `tb_sales_toss`와 `tb_iamweb_users`를 기준으로 월별 주문·결제 spine을 만들고, Attribution VM의 `payment_success`, `checkout_started`, `marketing_intent`를 보조 증거로 붙이는 순서가 맞다.

## 고등학생 비유

이 문서는 영수증 번호와 손님 입장권 번호를 맞추는 규칙표다.

영수증 번호는 실제 돈을 냈는지 확인하는 번호다. 입장권 번호는 그 손님이 어느 홍보물을 보고 왔는지 알려주는 번호다. 홍보물 번호만 보고 매출을 만들면 안 되고, 영수증이 있는 주문에만 홍보물 번호를 붙여야 한다.

## 관련 문서

| 문서 | 역할 |
|---|---|
| [[!total|월별 유입 채널 매출 정합성 계획]] | 전체 로드맵 정본 |
| [[source-inventory-20260504|월별 채널 매출 source 목록]] | source별 역할, 권한, 최신성 |
| [[monthly-spine-dry-run-contract-20260504|2026년 4월 biocom 주문·결제 spine dry-run 계약]] | 이 키 매트릭스를 적용한 첫 월별 계약 |
| [[attribution-vm-evidence-join-contract-20260504|Attribution VM evidence join 계약]] | 주문·결제 spine에 유입 증거를 붙이는 규칙 |
| [[../naver/!npayroas|NPay ROAS 정합성 문서]] | NPay intent와 confirmed 주문 분리 기준 |
| [[../meta/meta-roas-gap-confirmation-runbook-20260504|Meta ROAS gap 확인 런북]] | Meta ROAS 비교 기준 |

## 이번 조사에서 확인한 사실

| 확인 | 결과 | source/window/freshness/confidence |
|---|---|---|
| Toss 운영 결제 컬럼 | `payment_key`, `order_id`, `approved_at`, `canceled_at`, `total_amount`, `balance_amount`, `cancel_amount`, `status`, `method`, `store`, `mid` 확인 | source `public.tb_sales_toss information_schema`, window `2026-05-04 17:40 KST`, freshness live schema, confidence 96% |
| 아임웹 운영 주문 컬럼 | `order_number`, `payment_complete_time`, `payment_method`, `payment_status`, `final_order_amount`, `paid_price`, `total_refunded_price`, `raw_data` 확인 | source `public.tb_iamweb_users information_schema`, window `2026-05-04 17:40 KST`, freshness live schema, confidence 96% |
| 로컬 attribution ledger schema | `order_id`, `payment_key`, `checkout_id`, `ga_session_id`, UTM, `gclid`, `fbclid`, `ttclid`, `metadata_json` 확인 | source `backend/data/crm.sqlite3`, window `2026-05-04 17:40 KST`, freshness schema valid but data stale, confidence 95% |
| NPay intent schema | `intent_key`, `client_id`, `ga_session_id`, click id, UTM, 상품, `matched_order_no` 확인 | source `backend/data/crm.sqlite3#npay_intent_log`, window `2026-05-04 17:40 KST`, freshness schema valid, confidence 95% |
| 주문번호 정규화 함수 | `normalizeOrderIdBase`가 `-P1`, `_pay1` 계열 suffix를 제거 | source `backend/src/orderKeys.ts`, window `2026-05-04 17:40 KST`, freshness code current, confidence 94% |
| 아임웹 운영 백필 집계식 | `tb_iamweb_users`는 주문-상품 행 원장이므로 주문금액은 `SUM()`이 아니라 `MAX()`로 집계 | source `backend/scripts/backfill-iamweb-pre-2026-header.ts`, window `2026-05-04 17:40 KST`, freshness code current, confidence 94% |

## 키 용어

| 키 | 사람이 이해할 말 | 어디서 주로 나오는가 | 돈의 증거인가 | 유입 증거인가 | 주의 |
|---|---|---|---|---|---|
| `payment_key` | 토스 결제 고유번호 | Toss, Attribution VM | YES | NO | 있으면 결제 조인의 1순위다 |
| `order_id` | PG 결제 때 넘긴 주문 ID | Toss, Attribution VM | YES | 부분 | suffix가 붙을 수 있어 `orderIdBase`도 같이 봐야 한다 |
| `orderIdBase` | suffix를 제거한 주문 ID | backend 정규화 | YES | 부분 | `202604083892378-P1` 같은 값을 기본 주문번호로 맞춘다 |
| `order_number` | 아임웹 운영 주문번호 | `tb_iamweb_users` | YES | NO | NPay에서는 화면이나 GA4에 다른 번호가 보일 수 있다 |
| `channelOrderNo` | NPay 채널 주문번호 | `tb_iamweb_users.raw_data` | YES | 부분 | NPay return/GA4에서는 이 번호가 더 잘 보일 수 있다 |
| `transaction_id` | GA4 purchase 거래 ID | GA4 raw | 부분 | 부분 | sender마다 `order_number`, `order_code`, `channelOrderNo` 중 무엇을 넣었는지 확인 필요 |
| `checkout_id` | 결제창 진입 묶음 ID | Attribution VM | NO | YES | 결제 직전 유입 증거를 붙일 때 보조키다 |
| `ga_session_id` | GA4 세션 ID | GTM, GA4, VM | NO | YES | 주문 증명용이 아니라 유입 후보용이다 |
| `client_id` | GA4 사용자 브라우저 ID | GTM, GA4, VM | NO | YES | cross-device에는 약하다 |
| `fbclid`, `_fbc`, `_fbp` | Meta 클릭/브라우저 식별값 | 랜딩 URL, GTM, VM, CAPI | NO | YES | Meta 채널 증거지만 결제 증거는 아니다 |
| `gclid`, `gbraid`, `wbraid` | Google 클릭/브라우저 식별값 | 랜딩 URL, GTM, VM | NO | YES | Google 채널 증거지만 purchase 전환과 분리해야 한다 |
| `ttclid` | TikTok 클릭 ID | 랜딩 URL, GTM, VM | NO | YES | TikTok 채널 증거지만 confirmed 주문과 붙어야 한다 |
| `utm_*` | 광고 소재에 붙인 이름표 | 랜딩 URL, GTM, VM, GA4 | NO | YES | 사람이 만든 값이라 표준화가 중요하다 |

## source별 키 매트릭스

| source | 주요 키 | 금액/상태 필드 | 시각 필드 | 월별 spine에서 역할 | 실패 시 보강 |
|---|---|---|---|---|---|
| 운영 Toss `tb_sales_toss` | `payment_key`, `order_id`, `store`, `mid` | `total_amount`, `balance_amount`, `cancel_amount`, `status`, `method` | `approved_at`, `canceled_at`, `synced_at` | 결제 승인과 환불/취소 보정 1순위 | `orderIdBase`, 금액, 승인시각 |
| 운영 아임웹 `tb_iamweb_users` | `order_number`, `raw_data.channelOrderNo`, `customer_number` | `final_order_amount`, `paid_price`, `total_refunded_price`, `payment_status`, `payment_method` | `order_date`, `payment_complete_time` | 주문 존재, 상품, 결제수단, NPay 구분 1순위 | 주문번호, 채널 주문번호, 상품명, 금액 |
| 운영 PlayAuto `tb_playauto_orders` | 주문/배송 계열 키 | 주문 상태 계열 값 | `synced_at`, 주문/결제 시각 계열 | 주문 상태 cross-check | 아임웹/토스 불일치 때만 보조 |
| Attribution VM `payment_success` | `payment_key`, `order_id`, `checkout_id` | `payment_status`, `metadata_json` | `approved_at`, `logged_at` | 결제 완료와 유입 증거 연결 | `orderIdBase`, `approved_at`, `checkout_id` |
| Attribution VM `checkout_started` | `checkout_id`, `order_id`, `payment_key` | 없음 또는 metadata | `logged_at` | PG 이동 전 유입 앵커 | 같은 checkout/order/time window |
| Attribution VM `marketing_intent` | `ga_session_id`, `client_id`, UTM, click id | 없음 | `logged_at` | 랜딩 시점 유입 intent | 세션, 브라우저 ID, 시간 근접 |
| NPay `npay_intent_log` | `intent_key`, `client_id`, `ga_session_id`, `matched_order_no` | `product_price`, `matched_order_amount`, `matched_payment_method` | `captured_at`, `matched_at` | NPay 버튼 클릭 intent와 confirmed 주문 후보 | 상품명/금액/시간/회원/세션 |
| GA4 BigQuery raw | `ecommerce.transaction_id`, `user_pseudo_id`, `ga_session_id` | `ecommerce.purchase_revenue`, event params | `event_timestamp`, event date | `not set`, 중복 purchase, session source 분해 | biocom은 권한 확보 전 보류 |
| Meta/TikTok/Google Ads API | campaign/ad ids, click id reference | spend, platform conversion value | platform date | 참고 ROAS와 비용 | 내부 confirmed 주문과 분리 표시 |

## 주문·결제 spine 생성 순서

월별 spine은 한 주문을 한 줄로 만든 내부 정본 장부다. 여기서 spine은 채널 배정 전의 `돈 기준 주문 목록`이다.

| 순서 | 처리 | 이유 | 성공 기준 |
|---:|---|---|---|
| 1 | KST 월 범위를 먼저 고정 | 월말/월초 UTC 혼선을 막기 위해 | `date_start`, `date_end`, `timezone`, `queried_at`이 남음 |
| 2 | 운영 아임웹 주문을 `order_number` 단위로 집계 | 상품 행 중복으로 주문금액이 부풀지 않게 하기 위해 | `order_number` 1개당 1행 |
| 3 | 아임웹 주문금액은 주문 단위 `MAX()` 기준 사용 | `tb_iamweb_users`가 주문-상품 행을 반복 저장하기 때문 | 주문 총액이 상품 수만큼 곱해지지 않음 |
| 4 | 운영 Toss 결제를 `payment_key` 단위로 집계 | 실제 결제 승인과 취소 금액을 보기 위해 | 결제 1건당 승인/취소/net 값이 계산됨 |
| 5 | Toss `order_id`와 아임웹 `order_number`를 직접/정규화 조인 | 결제와 주문을 같은 거래로 묶기 위해 | direct 또는 `orderIdBase` match label이 남음 |
| 6 | NPay는 `order_number`와 `channelOrderNo`를 둘 다 보관 | GA4/return URL에 다른 번호가 남을 수 있기 때문 | NPay 주문의 조회 후보 ID가 2개 모두 남음 |
| 7 | 취소/환불은 Toss와 아임웹 상태를 모두 표시 | 결제사와 쇼핑몰 상태가 늦게 맞을 수 있기 때문 | gross, refund, net, status source가 분리됨 |
| 8 | 그래도 결제-주문이 안 붙으면 revenue는 보관하고 channel은 quarantine | 매출을 버리면 총액이 틀리기 때문 | `unknown_reason`이 남음 |

## 조인 우선순위

| 우선순위 | 조인 | confidence | 월별 산출 반영 |
|---:|---|---:|---|
| 1 | `payment_key` exact match | A 95~99% | 매출 spine과 유입 evidence 모두 사용 가능 |
| 2 | `order_id` exact match | A- 90~96% | 금액/시각이 맞으면 사용 |
| 3 | `orderIdBase` match | B+ 82~92% | suffix 제거 사유를 기록하고 사용 |
| 4 | 아임웹 `order_number`와 NPay `channelOrderNo` 보조 match | B 75~88% | NPay 보정 후보로 사용, 전송은 별도 승인 |
| 5 | `checkout_id` + 시간 근접 + 금액 근접 | C 60~75% | channel 후보만 표시, 예산 판단에는 보수적으로 반영 |
| 6 | `ga_session_id` 또는 `client_id`만 match | D 30~55% | 유입 힌트만 표시, 매출 귀속 확정 금지 |
| 7 | 플랫폼 API purchase value만 존재 | Reference | 내부 매출에 반영 금지 |

## 채널 증거 배정 규칙

| 증거 | primary channel 배정 가능 여부 | campaign ROAS 배정 가능 여부 | 설명 |
|---|---|---|---|
| confirmed 주문 + `payment_key` + `fbclid/_fbc` | 가능 | campaign id가 있거나 UTM mapping이 있으면 가능 | Meta 유입 강한 증거 |
| confirmed 주문 + `payment_key` + `gclid/gbraid/wbraid` | 가능 | Google campaign id/UTM mapping이 있으면 가능 | Google 유입 강한 증거 |
| confirmed 주문 + `payment_key` + `ttclid` | 가능 | TikTok campaign id/UTM mapping이 있으면 가능 | TikTok 유입 강한 증거 |
| confirmed 주문 + UTM만 있음 | 가능하나 confidence 낮음 | UTM 표준이 맞으면 가능 | 사람이 만든 값이므로 오타/내부 링크 오염 주의 |
| confirmed 주문 + referrer organic | 가능 | 해당 없음 | Organic/Search/Referral 후보 |
| confirmed 주문 + 유입 증거 없음 | `Unknown` 또는 `Direct` 보수 처리 | 불가 | direct 단정은 위험하므로 reason 필요 |
| click id만 있고 confirmed 주문 없음 | 불가 | 불가 | intent나 방문은 구매가 아니다 |
| 플랫폼이 purchase value를 주장하지만 내부 주문 없음 | 불가 | 참고값만 | cross-device 또는 플랫폼 attribution일 수 있으나 내부 매출 정본 아님 |

## site 누락 처리

`site`는 결제 키 자체가 아니라 라우팅과 필터링을 위한 보조 분류다. 월별 매출 정본에서 site가 비면 아래 순서로만 보강한다.

| 순서 | 처리 | 이유 | 실패 시 |
|---:|---|---|---|
| 1 | 운영 아임웹 source가 biocom 범위인지 확인 | 주문 원장이 가장 명확하기 때문 | 다음 단계 |
| 2 | Toss `store`, `mid`, `project`, `order_id` 패턴 확인 | 결제사 원장에서 site 후보를 얻기 위해 | 다음 단계 |
| 3 | Attribution VM `source`, landing host, referrer host 확인 | 유입 원장에 host가 남을 수 있기 때문 | 다음 단계 |
| 4 | `payment_key` exact lookup으로 이미 site가 있는 행과 연결 | 같은 결제키는 하나의 결제이기 때문 | 다음 단계 |
| 5 | 그래도 모르면 `quarantine_site_unknown` | 잘못된 site로 외부 전송하면 더 큰 문제가 생김 | 외부 전송 금지 |

중요한 결론은 `site=null`을 억지로 biocom에 넣지 않는 것이다. `payment_key`나 운영 주문으로 보강 가능한 경우에만 site를 확정하고, 그래도 모르면 monthly total에는 보관하되 paid channel/CAPI/플랫폼 전송 대상에서는 제외한다.

## NPay 특수 규칙

NPay는 버튼 클릭과 구매 완료가 같은 페이지 흐름으로 돌아오지 않을 수 있다. 그래서 일반 카드결제보다 조심해야 한다.

| 상황 | 처리 | 이유 |
|---|---|---|
| `npay_intent_log`만 있음 | purchase 아님. intent로만 보관 | 버튼 클릭은 구매가 아니다 |
| 운영 아임웹에 NPay confirmed 주문 있음 | revenue spine에 포함 | 주문 원장이 confirmed 구매의 정본이다 |
| `order_number`가 GA4에서 안 보임 | `channelOrderNo`도 같이 조회 | NPay 외부 주문번호가 남을 수 있다 |
| intent와 주문이 시간/상품/금액으로 붙음 | NPay recovery 후보 | GA4/광고 전송은 별도 승인 후 |
| intent와 주문이 애매함 | ambiguous | 잘못 보내면 ROAS가 부풀기 때문 |

## 중복과 금액 과대 방지

| 위험 | 방지 규칙 | 실패 시 표시 |
|---|---|---|
| 아임웹 상품 행을 주문금액으로 `SUM()` | `order_number` 단위 `MAX(final_order_amount)` | `amount_repeated_rows` |
| 같은 `payment_key`가 여러 source에서 반복 | `payment_key` dedupe | `duplicate_payment_key` |
| `order_id` suffix 때문에 미조인 | `normalizeOrderIdBase` 적용 | `order_id_suffix_unmatched` |
| GA4 purchase 중복 | `transaction_id`, event id, source sender 분리 | `ga4_duplicate_purchase_pending_raw` |
| NPay intent를 purchase로 오인 | confirmed 주문 전에는 purchase 금지 | `intent_without_order` |
| 플랫폼 conversion value를 내부 매출로 합산 | 플랫폼 값은 reference로만 보관 | `platform_value_not_internal_revenue` |

## 첫 dry-run 출력 필드 초안

| 필드 | 의미 |
|---|---|
| `site` | biocom, thecleancoffee 등 사이트 |
| `month_kst` | 산출 월 |
| `order_number` | 아임웹 주문번호 |
| `channel_order_no` | NPay 채널 주문번호 |
| `payment_key` | Toss 결제키 |
| `order_id` | Toss/PG 주문 ID |
| `order_id_base` | suffix 정규화 주문 ID |
| `payment_method` | card, npay, virtual 등 |
| `order_status` | 아임웹 주문 상태 |
| `payment_status` | Toss/Attribution 결제 상태 |
| `gross_revenue` | 주문 총액 |
| `refund_amount` | 환불/취소 금액 |
| `net_revenue` | 월별 정본 순매출 |
| `revenue_source` | Toss, Imweb, both, fallback |
| `join_method` | payment_key_exact, order_id_exact, order_id_base 등 |
| `join_confidence` | A/B/C/D |
| `primary_channel` | Meta, TikTok, Google, Naver, Organic, Direct, Referral, CRM, Unknown |
| `channel_evidence` | click id, UTM, referrer, VM ledger 등 |
| `campaign_id` | 플랫폼 캠페인 ID |
| `utm_campaign` | 랜딩 시점 UTM campaign |
| `unknown_reason` | 미분류 또는 보류 사유 |
| `source_freshness` | source 최신성 메타데이터 |
| `queried_at` | 산출 시각 |

## 첫 dry-run 대상 기간 추천

| 후보 | 추천 | 이유 | 주의 |
|---|---:|---|---|
| 2026-04-01~2026-04-30 KST | 94% | Meta/TikTok/GDN/NPay 정합성 작업의 기존 문서와 겹치고, 운영 Toss/Imweb/VM source가 살아 있음 | 로컬 SQLite mirror는 stale이므로 운영/VM read-only 중심 |
| 2026-05-01~2026-05-03 KST | 78% | 최신성 확인에는 좋음 | 월 전체가 아니어서 월별 close 검증에는 약함 |
| 최근 7일 | 70% | `/ads`와 비교 쉬움 | 월별 채널 매출 목적과 다름 |

추천은 2026년 4월 전체 KST다. 월별 close 프로세스를 만들기 위해서는 완성된 한 달이 필요하고, 현재 source 최신성도 이 기간을 read-only로 다시 계산하기에 충분하다.

## 실패 시 해석 규칙

| 실패 | 의미 | 다음 확인점 |
|---|---|---|
| Toss에는 있는데 Imweb에 없음 | 결제는 있으나 주문 sync/번호 mapping 문제 가능 | `order_id`, `orderIdBase`, 금액, 승인시각, Imweb API |
| Imweb에는 있는데 Toss에 없음 | NPay/무료결제/가상계좌/운영DB sync 차이 가능 | `payment_method`, `payment_status`, `paid_price` |
| Attribution VM에는 있는데 Toss/Imweb에 없음 | 방문 또는 checkout만 있고 결제 미완료일 수 있음 | `touchpoint`, `payment_status`, `approved_at` |
| GA4에는 있는데 운영 주문이 없음 | duplicate purchase 또는 transaction_id 오염 가능 | GA4 raw 권한 확보 후 sender/event_id 분해 |
| 플랫폼에는 있는데 내부 주문이 없음 | 플랫폼 attribution/cross-device/기여 window 가능 | platform reference로만 보관 |
| site가 비어 있음 | 라우팅 보강 필요 | host/payment/order lookup 후 실패하면 quarantine |

## 지금 기준 결정

| 결정 | 결론 | 자신감 |
|---|---|---:|
| 월별 spine 1순위 source | 운영 Toss + 운영 아임웹 | 94% |
| 로컬 SQLite 사용 | 최신 월 판단에는 금지, schema와 fallback에만 사용 | 96% |
| 첫 dry-run 기간 | 2026년 4월 KST 전체 | 94% |
| `payment_key` 조인 우선순위 | 가장 높음 | 97% |
| GA4 raw 의존 | 권한 전까지 보류 | 96% |
| NPay intent 사용 | 구매가 아니라 보정 후보로만 사용 | 98% |
| site unknown 처리 | 보강 실패 시 quarantine, 외부 전송 금지 | 95% |

## Codex가 다음에 바로 할 일

| 순서 | 작업 | 왜 하는가 | 어떻게 하는가 | 성공 기준 | 승인 필요 | 추천 |
|---:|---|---|---|---|---|---:|
| 1 | 운영 NPay intent source를 연결해 139건 matching을 재실행한다 | 로컬 `npay_intent_log` 0건 기준으로 unmatched 결론을 내리면 오판이다 | token 또는 VM SQLite snapshot을 연결해 같은 script를 재실행한다 | `sourceAccess=available`, `liveIntentCount>0`, 139건 matched/ambiguous/unmatched 분포가 나온다 | YES, token/snapshot 필요 | 82% |
| 2 | 플랫폼 API reference value를 월별 window로 붙인다 | skeleton만 있으면 플랫폼 gap 숫자를 아직 계산할 수 없다 | Meta/TikTok/Google/Naver value를 내부 revenue에 합산하지 않고 `platformReference`로만 둔다 | platform reference value와 gap 필드가 생긴다 | NO, read-only API만 | 81% |
| 3 | script를 local API route로 승격할지 판단한다 | `/total` 화면에서 호출할 수 있는 데이터 계약이 필요할 수 있다 | script 출력과 route 응답 필드를 비교한다 | route 구현 또는 보류 사유가 남는다 | 로컬 NO, 운영 배포 YES | 82% |

## TJ님이 할 일

운영 NPay intent 재실행에는 token 또는 VM SQLite snapshot이 필요하다. platformReference skeleton과 `/total` API 계약은 Codex가 read-only로 진행 완료했다.

나중에 GA4 `not set`, 중복 purchase, session source를 주문 단위로 닫을 때는 TJ님 또는 허들러스가 BigQuery 권한을 줘야 한다.

| 조건 | TJ님 요청 | 이유 | 추천 |
|---|---|---|---:|
| GA4 raw로 `transaction_id`를 주문 단위 검증해야 할 때 | 서비스 계정 `seo-656@seo-aeo-487113.iam.gserviceaccount.com`에 `hurdlers-naver-pay.analytics_304759974` BigQuery Data Viewer 권한 부여 | 현재 permission denied라 Codex가 대신 해결할 수 없음 | 88% |

## 변경 기록

| 시각 | 변경 |
|---|---|
| 2026-05-04 17:45 KST | 최초 작성. 월별 주문·결제 spine을 만들기 위한 source별 key, 조인 우선순위, NPay/site/null 처리, 첫 dry-run 기간 추천 정리 |
| 2026-05-04 18:05 KST | [[monthly-spine-dry-run-contract-20260504]] 연결. 다음 작업을 dry-run script/read-only route 초안으로 갱신 |
| 2026-05-04 18:01 KST | `backend/scripts/monthly-spine-dry-run.ts` 검증 완료 반영. 다음 작업을 Attribution VM evidence join 계약으로 갱신 |
| 2026-05-04 18:04 KST | [[attribution-vm-evidence-join-contract-20260504]] 연결. 다음 작업을 evidence join dry-run script 초안으로 갱신 |
| 2026-05-04 18:12 KST | `backend/scripts/monthly-evidence-join-dry-run.ts` 검증 완료 반영. 다음 작업을 NPay intent 매칭과 channel assignment v0.2로 갱신 |
| 2026-05-04 18:27 KST | `monthly-evidence-join-dry-run-v0.2` 결과 반영. 다음 작업을 paid_naver 샘플 감사와 운영 NPay intent source 연결로 갱신 |
| 2026-05-04 18:28 KST | paid_naver 샘플 감사 완료 반영. 다음 작업을 platform_reference skeleton과 운영 NPay intent source 연결로 갱신 |
| 2026-05-04 18:51 KST | platformReference skeleton과 `/total` API 계약 완료 반영. 다음 작업을 운영 NPay intent source와 플랫폼 API reference value 연결로 갱신 |
