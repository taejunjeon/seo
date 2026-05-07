# 월별 채널 매출 source 목록

작성 시각: 2026-05-04 17:16 KST
기준일: 2026-05-04
대상: biocom 우선. 이후 thecleancoffee, aibio, coffeevip로 확장.
문서 성격: Green Lane read-only 조사 결과. 운영 DB write, GTM 운영 게시, 광고 플랫폼 전환 송출은 하지 않았다.

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
    - data/!datacheckplan.md
    - meta/meta-roas-gap-confirmation-runbook-20260504.md
    - tiktok/!tiktokroasplan.md
    - gdn/!gdnplan.md
    - naver/!npayroas.md
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
    source: "backend route/code, source freshness script, 운영 Postgres SELECT, Attribution VM read-only API, 기존 ROAS 정본 문서"
    window: "2026-05-04 17:16 KST 조사 시점"
    freshness: "운영 Toss/Postgres와 Attribution VM은 fresh. 로컬 SQLite mirror는 stale. biocom GA4 BigQuery raw는 permission denied."
    confidence: 0.88
```

## 10초 결론

월별 채널 매출 분류의 정본 매출은 `Toss 운영 결제 원장 + 아임웹 운영 주문 원장 + 취소/환불 보정`으로 잡아야 한다.

유입 채널 증거는 `TJ 관리 Attribution VM 원장`을 1순위로 쓴다. 결제 완료 시점뿐 아니라 `marketing_intent`, `checkout_started`, `payment_success`가 남아 있어 Meta, TikTok, Google, Organic을 나눌 수 있기 때문이다.

로컬 SQLite는 지금 최신 판단 source로 쓰면 안 된다. 2026-05-04 17:16 KST read-only 점검 기준 로컬 Toss, Imweb, attribution mirror가 stale이다. 반대로 운영 Toss/Postgres와 Attribution VM API는 최신성이 살아 있다.

가장 큰 막힘은 biocom GA4 BigQuery raw 권한이다. 현재 서비스 계정으로 `hurdlers-naver-pay.analytics_304759974` 접근 시 permission denied가 확인됐다.

## 고등학생 비유

이 문서는 학교 축제 매출을 정산할 때 `실제 돈 받은 장부`, `손님이 어디서 왔는지 적은 방문 기록`, `각 홍보팀이 자기 덕분이라고 주장하는 보고서`를 나눠 놓은 표다.

실제 돈은 통장 장부로 확인하고, 유입 경로는 방문 기록을 보고 붙인다. 홍보팀 보고서는 참고하되 그대로 정답으로 쓰지 않는다.

## 관련 문서

| 문서 | 역할 |
|---|---|
| [[!total|월별 유입 채널 매출 정합성 계획]] | 전체 로드맵 정본 |
| [[join-key-matrix-20260504|주문·결제 조인 키 매트릭스]] | source별 키를 실제 월별 spine으로 붙이는 규칙 |
| [[monthly-spine-dry-run-contract-20260504|2026년 4월 biocom 주문·결제 spine dry-run 계약]] | 첫 월별 spine 산출 계약과 sanity check |
| [[attribution-vm-evidence-join-contract-20260504|Attribution VM evidence join 계약]] | spine에 채널 증거를 붙이는 규칙 |

## 이번 조사에서 실제 확인한 것

| 확인 | 결과 | source/window/freshness/confidence |
|---|---|---|
| source freshness script 실행 | 성공 | source `backend/scripts/check-source-freshness.ts`, window `2026-05-04 17:16 KST`, freshness live read-only, confidence 92% |
| 운영 Toss 원장 | fresh | `tb_sales_toss`, max `approved_at=2026-05-04 05:59:03`, max `synced_at=2026-05-03 21:00:08`, confidence 93% |
| 운영 PlayAuto 주문 원장 | fresh | `tb_playauto_orders`, max `synced_at=2026-05-03 20:00:08`, confidence 88% |
| 운영 아임웹 주문 원장 | fresh로 판단 가능 | `tb_iamweb_users` read-only SELECT, rows 98,466, orders 79,928, max `order_date=2026-05-04 16:40:35`, max `payment_complete_time=2026-05-04T07:42:13.000Z`, confidence 90% |
| Attribution VM 원장 | fresh | `https://att.ainativeos.net/api/attribution/ledger?source=biocom_imweb&limit=3`, latestLoggedAt `2026-05-04T08:16:48.101Z`, confidence 92% |
| 로컬 Toss mirror | stale | `backend/data/crm.sqlite3#toss_transactions`, max sync `2026-04-24 05:16:40`, confidence 95% |
| 로컬 Imweb mirror | stale | `backend/data/crm.sqlite3#imweb_orders`, max sync `2026-04-24T13:44:24.597Z`, event max `2026-04-15`, confidence 95% |
| 로컬 attribution mirror | stale/data_sparse | `backend/data/crm.sqlite3#attribution_ledger`, latest local `2026-04-12`, confidence 95% |
| thecleancoffee GA4 BigQuery raw | fresh | `project-dadba7dd-0229-4ff6-81c.analytics_326949178.events_20260503`, purchase 14, confidence 89% |
| biocom GA4 BigQuery raw | blocked | `hurdlers-naver-pay.analytics_304759974`, permission denied, confidence 96% |

## source 역할 요약

| source | 보관 위치 | 역할 | 월별 분류에서 사용 방식 | 현재 판단 |
|---|---|---|---|---|
| Toss 운영 결제 원장 | 운영 Postgres `public.tb_sales_toss` | 결제 승인, 결제수단, 환불/취소 보정 | 매출 정본의 핵심 | primary |
| 아임웹 운영 주문 원장 | 운영 Postgres `public.tb_iamweb_users` | 주문번호, 상품, 결제상태, NPay 채널 주문번호 | 주문 존재와 상품/결제수단 정본 | primary |
| PlayAuto 운영 주문 원장 | 운영 Postgres `public.tb_playauto_orders` | 주문/결제 sync, 주문 상태 cross-check | 아임웹/토스 대조 보조 | cross-check |
| Attribution VM 원장 | `att.ainativeos.net` SQLite `attribution_ledger` | 랜딩, UTM, click id, checkout, payment_success | 유입 채널 증거 정본 | primary evidence |
| NPay intent 로그 | VM/SQLite `npay_intent_log` | NPay 버튼 클릭 시점의 session, 광고키, 상품 | NPay return 누락 보정 후보 | cross-check/evidence |
| GA4 Data API | GA4 API route | 세션/행동 집계 | 주문 단위보다는 보조 진단 | cross-check |
| GA4 BigQuery raw | BigQuery `events_*` | transaction_id, session source, duplicate purchase 원인 | 주문 단위 원인 분해 | biocom blocked |
| Meta Ads API | Graph API v22 | spend, platform purchase value, attribution window | 플랫폼 참고 ROAS와 비용 | reference |
| Google Ads API | Google Ads API | spend, conversion_action, campaign metrics | 플랫폼 참고 ROAS와 비용 | reference |
| TikTok Ads API/캐시 | 로컬 SQLite `tiktok_ads_daily`, API JSON/CSV | TikTok spend, platform purchase value | 플랫폼 참고 ROAS와 비용 | reference |
| 자체 CAPI 로그 | `backend/logs/meta-capi-sends.jsonl`, TikTok send/shadow logs | 서버 전송 성공, event_id, duplicate 진단 | 전송 품질 확인. 매출 정본 아님 | diagnostics |
| 로컬 SQLite mirror | `backend/data/crm.sqlite3` | 개발/화면 캐시, 과거 분석 snapshot | 최신 월 판단에는 fallback만 | fallback/stale |

## 주문·결제 정본 source

| source | 주요 키 | 강점 | 한계 | 월별 채널 분류 규칙 |
|---|---|---|---|---|
| `tb_sales_toss` | `payment_key`, `order_id`, `approved_at`, `amount`, `method`, `status` | 실제 결제 승인과 환불/취소 보정에 강함 | 유입 채널 정보는 없음 | 매출 확정과 net revenue 계산의 1순위 |
| `tb_iamweb_users` | `order_number`, `payment_complete_time`, `payment_method`, `payment_status`, `raw_data.channelOrderNo`, `product_name` | 주문번호, 상품, NPay 주문 보정에 강함 | 주문-상품 행 원장이므로 주문금액 중복 집계 주의 | 주문 존재, 상품군, NPay 보정, 주문 상태 대조 |
| `tb_playauto_orders` | `ord_time`, `pay_time`, 주문 상태 계열 컬럼 | 운영 주문 sync 최신성 확인 가능 | 전환 시각 정본으로 쓰기 어려운 컬럼이 있음 | 주문 상태 보조 검산 |
| Toss API | `/api/toss/transactions`, `/api/toss/settlements`, `/api/toss/payments/orders/:orderId` | 개별 결제 상세 재조회 가능 | API 호출 비용/기간 제한, 운영 DB sync와 별도 | 샘플 검증과 로컬 mirror 보강 |
| Imweb API/로컬 `imweb_orders` | `order_no`, `order_time`, `complete_time`, `imweb_status` | 구매확정 시각 분석에 유용 | 현재 로컬 mirror stale | 과거 지연 분석/fallback만 사용 |

## 유입 증거 source

| source | 주요 키 | 강점 | 한계 | 월별 채널 분류 규칙 |
|---|---|---|---|---|
| Attribution VM `marketing_intent` | `landing`, `referrer`, `utm_*`, `gclid`, `fbclid`, `ttclid`, `ga_session_id`, `metadata.clientId` | 결제 전에 유입 흔적을 저장 | 현재 TikTok 중심으로 엄격 저장된 흔적이 많음 | first-touch 또는 paid-click 증거 |
| Attribution VM `checkout_started` | `checkout_id`, `order_id`, `payment_key`, `utm_*`, click ids, `metadata.firstTouch` | PG 이동 전 마지막 앵커 | 모든 상품/사이트에 완전 적용 여부 확인 필요 | 결제 직전 채널 증거 |
| Attribution VM `payment_success` | `order_id`, `payment_key`, `payment_status`, `approved_at`, `landing`, `referrer` | 주문과 유입 증거가 직접 붙는 핵심 | pending/canceled 동기화가 중요 | primary channel의 강한 증거 |
| `npay_intent_log` | `intent_key`, `client_id`, `ga_session_id`, `gclid`, `fbclid`, `fbc`, `fbp`, `utm_*`, `product_idx` | NPay return 누락 보정 가능 | 클릭은 구매가 아니므로 confirmed 주문과 매칭 전 전송 금지 | NPay 구매 복구 후보 |
| GA4 raw `events_*` | `ecommerce.transaction_id`, `user_pseudo_id`, `ga_session_id`, collected traffic source | `not set`, duplicate purchase 원인 분해 | biocom raw 권한 blocked | 권한 확보 후 C급 보조 증거 |
| GA4 Data API | source/medium, purchase count, revenue | 빠른 집계 진단 | 주문 단위 원인 분해 약함 | 월별 요약 cross-check |

## 광고 플랫폼 source

| source | 읽는 경로 | 주요 값 | 월별 사용 | 주의 |
|---|---|---|---|---|
| Meta Ads API | `/api/ads/roas`, `/api/ads/roas/daily`, `/api/ads/site-summary`, `/api/meta/insights` | spend, action_values, purchase_roas, campaign_id | spend와 플랫폼 참고 ROAS | Meta attribution window와 cross-device 때문에 내부 confirmed와 다를 수 있음 |
| Google Ads API | `/api/google-ads/status`, `/api/google-ads/dashboard` | cost, conversion_value, conversion_action, campaign_id | spend와 플랫폼 참고 ROAS | 현재 Primary NPay count label 오염이 확인됨 |
| TikTok Ads API/캐시 | `/api/ads/tiktok/roas-comparison`, `tiktok_ads_daily` | spend, purchase_value, cta/vta value, campaign_id | spend와 플랫폼 참고 ROAS | 플랫폼 purchase value는 내부 confirmed 매출 아님 |
| Naver/NPay | `npay_intent_log`, `tb_iamweb_users`, GA4 MP 제한 테스트 문서 | NPay click intent, confirmed NPay order | return 누락 보정 | intent만으로 purchase 전송 금지 |

## join key matrix

| 목적 | 1순위 키 | 보강 키 | 실패 시 처리 |
|---|---|---|---|
| Toss 결제와 주문 연결 | `payment_key` | `order_id`, `order_no`, `order_code`, payment key prefix | 금액/시각/상품으로 보조 대조. 그래도 실패하면 매출 정본에는 두되 유입 채널은 unknown |
| 아임웹 주문과 NPay 주문 연결 | `order_number` | `raw_data.channelOrderNo`, `payment_complete_time`, 상품명, 금액 | `channel_order_no`를 GA4/BigQuery 조회 ID에 같이 넣음 |
| Attribution VM과 주문 연결 | `payment_key` | `order_id`, `orderIdBase`, `approved_at`, `checkout_id` | 결제 증거 없으면 paid channel 강제 배정 금지 |
| GA4 purchase와 주문 연결 | `ecommerce.transaction_id` | `order_no`, `order_code`, `channelOrderNo`, `ga_session_id`, `user_pseudo_id` | biocom raw 권한 없으면 주문 단위 분해 보류 |
| Meta 캠페인 연결 | `campaign_id` | `adset_id`, `ad_id`, `utm_campaign`, `utm_term`, `utm_content`, `fbclid/_fbc` | channel은 Meta 후보 가능, campaign ROAS는 unknown |
| Google 캠페인 연결 | `gclid`, `gbraid`, `wbraid` | `gad_campaignid`, `utm_source=google`, campaign_id | platform claim만 있으면 primary channel 배정 금지 |
| TikTok 캠페인 연결 | `ttclid` | `utm_source=tiktok`, `metadata.firstTouch`, TikTok pixel event | confirmed 주문과 조인 전 platform purchase로 쓰지 않음 |
| Organic/Direct 분류 | referrer, landing URL | GA4 session source, collected traffic source | 결제 리다이렉션 유실이면 direct 단정 금지 |

## 현재 source 최신성 판정

| source | 현재 상태 | 운영 판단 사용 여부 | 이유 |
|---|---|---|---|
| 운영 Toss `tb_sales_toss` | fresh | 사용 | 결제 승인 최신성이 2026-05-04까지 살아 있음 |
| 운영 아임웹 `tb_iamweb_users` | fresh | 사용 | read-only SELECT 기준 주문/결제 완료가 2026-05-04까지 있음 |
| 운영 PlayAuto `tb_playauto_orders` | fresh | 보조 사용 | 주문 상태 cross-check에 유효 |
| Attribution VM API | fresh | 사용 | latestLoggedAt이 조사 시점과 거의 같음 |
| 로컬 Toss mirror | stale | 최신 판단 금지 | sync가 2026-04-24에서 멈춤 |
| 로컬 Imweb mirror | stale | 최신 판단 금지 | order event가 2026-04-15에서 멈춤 |
| 로컬 attribution mirror | stale/data_sparse | 최신 판단 금지 | 2026-04-12 이후 비어 있음 |
| biocom GA4 BigQuery raw | permission denied | 주문 단위 GA4 분해 불가 | TJ/허들러스 권한 필요 |
| thecleancoffee GA4 BigQuery raw | fresh | coffee 확장 시 사용 | latest table 2026-05-03 |

## 지금 기준 월별 분류 설계 결론

| 판단 | 결론 | 자신감 |
|---|---|---:|
| 매출 정본 | 운영 Toss + 운영 아임웹 주문을 1순위로 쓴다 | 93% |
| 유입 증거 정본 | Attribution VM API/SQLite를 1순위로 쓴다 | 91% |
| 로컬 SQLite 사용 | 최신 월 판단에서는 fallback만 허용한다 | 96% |
| GA4 사용 | biocom raw 권한 확보 전까지는 보조 집계만 사용한다 | 90% |
| 플랫폼 API 사용 | spend와 platform reference ROAS로만 쓴다 | 94% |
| NPay 처리 | intent와 confirmed 주문 매칭 전 purchase 전송 금지 | 93% |

## Codex가 다음에 바로 할 일

| 순서 | 작업 | 왜 하는가 | 성공 기준 | 승인 필요 | 추천 |
|---:|---|---|---|---|---:|
| 1 | 운영 NPay intent source를 연결해 139건 matching을 재실행한다 | 로컬 `npay_intent_log` 0건 기준으로 unmatched 결론을 내리면 오판이다 | `sourceAccess=available`, `liveIntentCount>0`, 139건 matched/ambiguous/unmatched 분포가 나옴 | YES, token/snapshot 필요 | 82% |
| 2 | 플랫폼 API reference value를 월별 window로 붙인다 | skeleton만 있으면 플랫폼 gap 숫자를 아직 계산할 수 없다 | Meta/TikTok/Google/Naver value가 `platformReference`에 source metadata와 함께 남음 | NO, read-only API만 | 81% |
| 3 | script를 local API route로 승격할지 판단한다 | `/total` 프론트엔드가 호출할 API 계약이 필요할 수 있다 | route 구현 또는 보류 사유가 남음 | 로컬 NO, 운영 배포 YES | 82% |

## TJ님이 할 일

대부분은 Codex가 계속 진행할 수 있다. 다만 운영 NPay intent 139건 재실행은 token 또는 VM SQLite snapshot이 있어야 한다.

biocom GA4 BigQuery raw 권한도 막혀 있지만, 먼저 Codex가 platformReference skeleton과 `/total` API 계약은 진행 완료했다. 이후 GA4 raw가 꼭 필요한 단계에서 아래처럼 요청한다.

| 조건 | TJ님 요청 | 이유 | 추천 |
|---|---|---|---:|
| NPay 139건을 실제 intent source로 재실행할 때 | `NPAY_INTENT_ADMIN_TOKEN` 또는 VM SQLite snapshot 제공 | 로컬 `npay_intent_log`가 0건이라 Codex가 matched/unmatched를 확정할 수 없음 | 82% |
| GA4 `not set`, duplicate purchase, session source를 주문 단위로 닫을 때 | 서비스 계정 `seo-656@seo-aeo-487113.iam.gserviceaccount.com`에 `hurdlers-naver-pay.analytics_304759974` BigQuery Data Viewer 권한 부여 요청 | 현재 permission denied라 Codex가 대신 해결 불가 | 88% |

## 변경 기록

| 시각 | 변경 |
|---|---|
| 2026-05-04 17:16 KST | 최초 작성. source freshness, Attribution VM API, 운영 Postgres read-only 확인 결과를 월별 채널 매출 source inventory로 정리 |
| 2026-05-04 17:45 KST | [[!total_past]] 및 [[join-key-matrix-20260504]] 연결. 다음 작업을 주문·결제 spine dry-run SQL/API 계약으로 갱신 |
| 2026-05-04 18:05 KST | [[monthly-spine-dry-run-contract-20260504]] 연결. 다음 작업을 dry-run script/read-only route 초안으로 갱신 |
| 2026-05-04 18:01 KST | `backend/scripts/monthly-spine-dry-run.ts` 검증 완료 반영. 다음 작업을 Attribution VM evidence join 계약으로 갱신 |
| 2026-05-04 18:04 KST | [[attribution-vm-evidence-join-contract-20260504]] 연결. 다음 작업을 evidence join dry-run script 초안으로 갱신 |
| 2026-05-04 18:12 KST | `backend/scripts/monthly-evidence-join-dry-run.ts` 검증 완료 반영. 다음 작업을 NPay intent 매칭과 channel assignment v0.2로 갱신 |
| 2026-05-04 18:27 KST | `monthly-evidence-join-dry-run-v0.2` 결과 반영. 다음 작업을 paid_naver 샘플 감사와 운영 NPay intent source 연결로 갱신 |
| 2026-05-04 18:28 KST | paid_naver 샘플 감사 완료 반영. 다음 작업을 platform_reference skeleton과 운영 NPay intent source 연결로 갱신 |
| 2026-05-04 18:51 KST | platformReference skeleton과 `/total` API 계약 완료 반영. 다음 작업을 운영 NPay intent source와 플랫폼 API reference value 연결로 갱신 |
