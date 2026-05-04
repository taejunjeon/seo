# TikTok Events API Shadow Candidate Human Review

작성 시각: 2026-05-03 12:23 KST
Project: TikTok ROAS 정합성 개선
Sprint: TikTok Events API Shadow Candidate Ledger Human Review
Lane: Green
Mode: VM SQLite read-only review
Auditor verdict: PASS_WITH_NOTES
현재 판정: 17건 후보 검토 완료. Test Events only 후보는 3건까지 추천 가능하지만 실제 전송은 금지 상태 유지
자신감: 86%

> 2026-05-04 13:37 KST 정정:
> 이 문서의 A/B/C 분류는 당시 VM shadow row를 사람이 읽기 쉽게 재작성한 기록이다. 이후 production canary 사후 감사에서 shadow 후보 생성 로직이 다른 `marketing_intent` row의 TikTok evidence를 주문 후보에 섞을 수 있음이 확인됐다. 특히 `202605036519253`은 주문별 재검산 결과 `no_tiktok_evidence`로 차단되어야 한다. 이 문서는 과거 감사 기록으로만 유지하고, 추가 Test Events/production send 근거로 쓰지 않는다. 패치된 로직으로 shadow 후보를 재생성한 뒤 새 후보 검토표를 만든다.

```yaml
harness_preflight:
  common_harness_read: "harness/common/HARNESS_GUIDELINES.md, harness/common/AUTONOMY_POLICY.md, harness/common/REPORTING_TEMPLATE.md"
  project_harness_read: "harness/tiktok/LESSONS.md"
  required_context_docs:
    - "AGENTS.md"
    - "docurule.md"
    - "docs/report/text-report-template.md"
    - "tiktok/tiktok_events_api_shadow_ledger_design.md"
    - "tiktok/tiktok_events_api_shadow_ledger_approval.md"
    - "tiktok/tiktok_events_api_shadow_ledger_vm_dry_run_result.md"
  lane: "Green"
  allowed_actions:
    - "VM SQLite read-only query"
    - "human-readable candidate review"
    - "payload preview document"
    - "approval draft document"
    - "audit"
    - "commit/push"
  forbidden_actions:
    - "TikTok Events API production send"
    - "TikTok Test Events send"
    - "GA4/Meta/Google 전환 전송"
    - "GTM 변경"
    - "Purchase Guard 변경"
    - "개발팀 관리 운영DB PostgreSQL write"
    - "VM SQLite write"
  source_window_freshness_confidence:
    source: "TJ 관리 Attribution VM SQLite CRM_LOCAL_DB_PATH#tiktok_events_api_shadow_candidates"
    window: "candidate_version=2026-05-03.shadow.v1, 최근 7일 기반 apply 결과 17건"
    freshness: "2026-05-03 12:23 KST read-only query"
    site: "biocom"
    confidence: 0.86
```

## 10초 요약

VM shadow 원장 17건을 사람이 읽는 기준으로 재분류했다.

결론은 A 5건, B 4건, C 6건, 차단 정상 2건이다. Test Events only로 가장 먼저 볼 후보는 A 등급 3건이며, production send는 아직 Red Lane이다.

## 기준

이 검토는 TikTok으로 아무것도 보내지 않았다.

읽은 DB:
- TJ 관리 Attribution VM SQLite
- 테이블: `CRM_LOCAL_DB_PATH#tiktok_events_api_shadow_candidates`
- 조건: `candidate_version='2026-05-03.shadow.v1'`
- 조회 방식: read-only

보지 않은 DB:
- 개발팀 관리 운영DB PostgreSQL `dashboard.public.tb_iamweb_users`
- 로컬 개발 DB `/Users/vibetj/coding/seo/backend/data/crm.sqlite3`

## 등급 기준

| 등급 | 의미 | 기준 |
|---|---|---|
| A | TikTok Test Events 후보로 가장 안전 | confirmed, `released_confirmed_purchase`, `allow_purchase`, ttclid 있음, TikTok UTM 있음, dedup ready, PII 없음 |
| B | 추가 확인 후 후보 | confirmed, `allow_purchase`, ttclid/referrer/metadata 근거 있음, dedup ready. 다만 현재 UTM이 naver/meta 등으로 섞여 attribution 설명이 필요 |
| C | production send 후보로는 아직 약함 | confirmed와 ttclid는 있으나 Guard 최종 흐름이 `released_unknown_purchase` 또는 `hold_or_block_purchase`라 Test Events 전에도 원인 확인 필요 |
| 차단 정상 | 서버 이벤트 후보 아님 | pending 가상계좌, 미확정, dedup not ready, 또는 Guard가 Purchase를 낮춤 |

## 등급 분포

| 분류 | 건수 | 금액 합계 | 판단 |
|---|---:|---:|---|
| A | 5 | 981,957 KRW | Test Events only 1-3건 후보 |
| B | 4 | 1,244,200 KRW | 추가 확인 후 Test Events 후보 가능 |
| C | 6 | 1,588,940 KRW | production send 후보로 약함 |
| 차단 정상 | 2 | 271,754 KRW | 보내면 안 됨 |
| 합계 | 17 | 4,086,851 KRW | VM shadow 원장 기준 |

Production send confidence:
- 현재 45%
- 이유: A/B 후보가 9건 있지만, TikTok Test Events 수신과 dedup diagnostics가 아직 없다.
- 따라서 production send는 계속 Red Lane이다.

## 17건 주문별 요약표

| no | order_no | order_code | amount | payment_status | eligible_for_future_send | block_reason | TikTok evidence summary | event_id_candidate | server_event_id_pattern | pixel_event_stage / final guard stage | dedup_ready | source_refs 요약 | 사람이 보는 판정 |
|---:|---|---|---:|---|---:|---|---|---|---|---|---:|---|---|
| 1 | 202605037591783 | o20260503680c6e15e5d4f | 485,000 KRW | confirmed | 1 | (none) | ttclid=Y, UTM=`inpork_biocom_igg`, referrer=`www.tiktok.com`, metadata match=Y | Purchase_o20260503680c6e15e5d4f | Purchase_{order_code} | released_unknown_purchase / hold_or_block_purchase | 1 | pixel action=unknown release, payment_success=confirmed, raw event_id hash 저장, 운영DB 미사용 | C. 결제는 confirmed이나 Guard가 request_error/unknown release라 production 후보로 약함 |
| 2 | 202605036519253 | o202605033af504ba376d9 | 484,500 KRW | confirmed | 1 | (none) | ttclid=Y, UTM=`tiktok_biocom_yeonddle_iggacidset`, referrer=`www.tiktok.com`, metadata match=Y | Purchase_o202605033af504ba376d9 | Purchase_{order_code} | released_confirmed_purchase / allow_purchase | 1 | pixel action=confirmed release, payment_success=confirmed, raw event_id hash 저장, 운영DB 미사용 | A. Test Events only 1순위 후보 |
| 3 | 202605037672134 | o202605023e6a5e4078ad0 | 471,200 KRW | confirmed | 1 | (none) | ttclid=Y, UTM=`naverbrandsearch_biocom_mo_mainhome`, referrer=`www.tiktok.com`, metadata match=Y | Purchase_o202605023e6a5e4078ad0 | Purchase_{order_code} | released_confirmed_purchase / allow_purchase | 1 | pixel action=confirmed release, payment_success=confirmed, raw event_id hash 저장, 운영DB 미사용 | B. 결제/guard는 좋지만 UTM이 naver라 attribution 설명 필요 |
| 4 | 202605039010808 | o202605028d25eccb8e245 | 283,000 KRW | confirmed | 1 | (none) | ttclid=Y, UTM=`meta_biocom_servicecatalog_service`, referrer=`www.tiktok.com`, metadata match=Y | Purchase_o202605028d25eccb8e245 | Purchase_{order_code} | released_confirmed_purchase / allow_purchase | 1 | pixel action=confirmed release, payment_success=confirmed, raw event_id hash 저장, 운영DB 미사용 | B. 결제/guard는 좋지만 UTM이 meta라 attribution 설명 필요 |
| 5 | 202605031131460 | o202605039f84479afa62b | 245,000 KRW | confirmed | 1 | (none) | ttclid=Y, UTM=`naver`, referrer=`www.tiktok.com`, metadata match=Y | Purchase_o202605039f84479afa62b | Purchase_{order_code} | released_confirmed_purchase / allow_purchase | 1 | pixel action=confirmed release, payment_success=confirmed, raw event_id hash 저장, 운영DB 미사용 | B. 결제/guard는 좋지만 UTM이 naver라 attribution 설명 필요 |
| 6 | 202605034720078 | o20260503280ef4f033341 | 245,000 KRW | confirmed | 1 | (none) | ttclid=Y, UTM=`tiktok_biocom_yeonddle_iggacidset`, referrer=`www.tiktok.com`, metadata match=Y | Purchase_o20260503280ef4f033341 | Purchase_{order_code} | released_unknown_purchase / hold_or_block_purchase | 1 | pixel action=unknown release, payment_success=confirmed, raw event_id hash 저장, 운영DB 미사용 | C. TikTok UTM은 강하지만 Guard가 request_error/unknown release |
| 7 | 202605035128012 | o20260502e4b577430ef96 | 245,000 KRW | confirmed | 1 | (none) | ttclid=Y, UTM=`naver`, referrer=`www.tiktok.com`, metadata match=Y | Purchase_o20260502e4b577430ef96 | Purchase_{order_code} | released_confirmed_purchase / allow_purchase | 1 | pixel action=confirmed release, payment_success=confirmed, raw event_id hash 저장, 운영DB 미사용 | B. 결제/guard는 좋지만 UTM이 naver라 attribution 설명 필요 |
| 8 | 202605032589641 | o202605036740b961e15b8 | 234,000 KRW | confirmed | 1 | (none) | ttclid=Y, UTM=`meta_story_kangman2_igg`, referrer=`www.tiktok.com`, metadata match=Y | Purchase_o202605036740b961e15b8 | Purchase_{order_code} | released_unknown_purchase / hold_or_block_purchase | 1 | pixel action=unknown release, payment_success=confirmed, raw event_id hash 저장, 운영DB 미사용 | C. UTM도 meta이고 Guard가 unknown release |
| 9 | 202605032641706 | o20260503bcb3e46e789a1 | 234,000 KRW | confirmed | 1 | (none) | ttclid=Y, UTM=`tiktok_biocom_yeonddle_iggacidset`, referrer=`www.tiktok.com`, metadata match=Y | Purchase_o20260503bcb3e46e789a1 | Purchase_{order_code} | released_confirmed_purchase / allow_purchase | 1 | pixel action=confirmed release, payment_success=confirmed, raw event_id hash 저장, 운영DB 미사용 | A. Test Events only 2순위 후보 |
| 10 | 202605035365850 | o202605031d3b81c3b4c5d | 234,000 KRW | confirmed | 1 | (none) | ttclid=Y, UTM=`tiktok_biocom_yeonddle_iggacidset`, referrer=`www.tiktok.com`, metadata match=Y | Purchase_o202605031d3b81c3b4c5d | Purchase_{order_code} | released_unknown_purchase / hold_or_block_purchase | 1 | pixel action=unknown release, payment_success=confirmed, raw event_id hash 저장, 운영DB 미사용 | C. TikTok UTM은 강하지만 Guard가 unknown release |
| 11 | 202605037035925 | o202605038e6e7a46b155d | 234,000 KRW | confirmed | 1 | (none) | ttclid=Y, UTM=`meta_story_kangman2_igg`, referrer=`www.tiktok.com`, metadata match=Y | Purchase_o202605038e6e7a46b155d | Purchase_{order_code} | released_unknown_purchase / hold_or_block_purchase | 1 | pixel action=unknown release, payment_success=confirmed, raw event_id hash 저장, 운영DB 미사용 | C. UTM도 meta이고 Guard가 unknown release |
| 12 | 202605033210469 | o2026050369134513c20f6 | 156,940 KRW | confirmed | 1 | (none) | ttclid=Y, UTM=`naverbrandsearch_biocom_pc_mainhome`, referrer=`www.tiktok.com`, metadata match=Y | Purchase_o2026050369134513c20f6 | Purchase_{order_code} | released_unknown_purchase / hold_or_block_purchase | 1 | pixel action=unknown release, payment_success=confirmed, raw event_id hash 저장, 운영DB 미사용 | C. UTM도 naver이고 Guard가 unknown release |
| 13 | 202605033205623 | o20260502e40c789932ac1 | 156,849 KRW | confirmed | 1 | (none) | ttclid=Y, UTM=`tiktok_biocom_yeonddle_iggacidset`, referrer=`www.tiktok.com`, metadata match=Y | Purchase_o20260502e40c789932ac1 | Purchase_{order_code} | released_confirmed_purchase / allow_purchase | 1 | pixel action=confirmed release, payment_success=confirmed, raw event_id hash 저장, 운영DB 미사용 | A. Test Events only 3순위 후보 |
| 14 | 202605037551791 | o20260502c9d76cae07cb9 | 99,000 KRW | confirmed | 1 | (none) | ttclid=Y, UTM=`tiktok_biocom_yeonddle_iggacidset`, referrer=`www.tiktok.com`, metadata match=Y | Purchase_o20260502c9d76cae07cb9 | Purchase_{order_code} | released_confirmed_purchase / allow_purchase | 1 | pixel action=confirmed release, payment_success=confirmed, raw event_id hash 저장, 운영DB 미사용 | A. Test Events 후보 가능 |
| 15 | 202605033077779 | o20260503c153a14a7c9c4 | 6,608 KRW | confirmed | 1 | (none) | ttclid=Y, UTM=`tiktok_biocom_yeonddle_iggacidset`, referrer=`www.tiktok.com`, metadata match=Y | Purchase_o20260503c153a14a7c9c4 | Purchase_{order_code} | released_confirmed_purchase / allow_purchase | 1 | pixel action=confirmed release, payment_success=confirmed, raw event_id hash 저장, 운영DB 미사용 | A. 금액이 작아 우선순위는 낮지만 구조는 안전 |
| 16 | 202605038990138 | o202605025c11b28623f2c | 245,000 KRW | confirmed | 0 | pending_virtual_account | ttclid=Y, UTM=`naverbrandsearch_biocom_mo_mainhome`, referrer=`www.tiktok.com`, metadata match=Y | Purchase_o202605025c11b28623f2c | Purchase_{order_code} | sent_replacement_place_an_order / block_purchase_virtual_account | 0 | pixel action=PlaceAnOrder replacement, payment_success=confirmed, raw event_id hash 저장, 운영DB 미사용 | 차단 정상. v1 규칙상 pending 가상계좌 이력이 있으면 서버 Purchase 후보 금지 |
| 17 | 202605032367365 | o202605022a005cfa6f10e | 26,754 KRW | pending | 0 | not_confirmed | ttclid=Y, UTM=`bio_subscribe`, referrer=`www.tiktok.com`, metadata match=Y | Purchase_o202605022a005cfa6f10e | Purchase_{order_code} | decision_received / hold_or_block_purchase | 0 | pixel action=decision_received, payment_success=pending, raw event_id hash 저장, 운영DB 미사용 | 차단 정상. 결제 상태가 pending이라 서버 Purchase 후보 금지 |

## Blocked 2건 Deep Dive

### 1. pending_virtual_account

주문:
- order_no: `202605038990138`
- order_code: `o202605025c11b28623f2c`
- amount: 245,000 KRW

왜 block인가:
- Pixel/Guard 로그 순서가 `purchase_intercepted -> decision_received -> blocked_pending_purchase -> sent_replacement_place_an_order`다.
- Guard 판정은 `block_purchase_virtual_account`이고 reason은 `toss_direct_api_status`다.
- 즉 브라우저 Purchase는 실제로 차단되고 `PlaceAnOrder`로 낮춰졌다.

왜 차단이 정상인가:
- v1 shadow 규칙은 pending 가상계좌 이력이 있으면 `eligible_for_future_send=false`로 둔다.
- 현재 `attribution_ledger.payment_success`는 confirmed로 보이지만, 이 row는 “가상계좌 발급 후 나중에 입금 확인된 주문”일 수 있다.
- 이 케이스를 바로 서버 Purchase 후보로 올리면 “입금 전 pending Purchase를 막는다”는 guard의 원칙과 충돌할 수 있다.

재평가 가능 조건:
- 가상계좌 발급 시점과 입금 확정 시점을 분리해 `deposit_confirmed` 또는 `virtual_account_paid` 같은 명확한 전환 상태를 기록해야 한다.
- 운영DB read-only 또는 Toss/Imweb 상태로 최종 입금 확정 시각을 교차 검산해야 한다.
- 이 보강 전에는 production send 후보로 올리지 않는다.

### 2. not_confirmed

주문:
- order_no: `202605032367365`
- order_code: `o202605022a005cfa6f10e`
- amount: 26,754 KRW

왜 block인가:
- `attribution_ledger.payment_success.payment_status=pending`이다.
- Pixel/Guard 로그는 `purchase_intercepted -> released_unknown_purchase -> decision_received`로 끝났다.
- Guard branch는 `hold_or_block_purchase`, reason은 `signal is aborted without reason`이다.

왜 차단이 정상인가:
- 서버 Purchase 후보는 confirmed 결제만 대상으로 해야 한다.
- pending 상태를 TikTok Events API로 보내면 TikTok ROAS가 다시 부풀 수 있다.

재평가 가능 조건:
- 이후 `payment_status=confirmed`로 바뀌고, same order_code에 대해 confirmed payment_success가 새로 적재되어야 한다.
- 그때도 dedup event_id가 `Purchase_{order_code}`로 맞고 raw PII가 없어야 한다.

## Test Events Only 후보 1-3건

실제 전송은 하지 않는다. 아래는 payload preview다.

### 후보 1

추천 이유:
- A 등급
- confirmed payment_success
- `released_confirmed_purchase / allow_purchase`
- TikTok UTM + ttclid + TikTok referrer + metadata match
- dedup ready

```json
{
  "order_no": "202605036519253",
  "order_code": "o202605033af504ba376d9",
  "pixel_code": "D5G8FTBC77UAODHQ0KOG",
  "event": "Purchase",
  "event_id": "Purchase_o202605033af504ba376d9",
  "timestamp_source": "attribution_ledger.payment_success.logged_at",
  "properties": {
    "currency": "KRW",
    "value": 484500,
    "content_type": "product",
    "order_id": "202605036519253"
  },
  "context_preview": {
    "has_ttp": false,
    "has_ttclid": true,
    "has_user_agent": false,
    "has_ip": false,
    "raw_pii_included": false
  },
  "send_mode": "shadow_only",
  "send_candidate": false
}
```

### 후보 2

```json
{
  "order_no": "202605032641706",
  "order_code": "o20260503bcb3e46e789a1",
  "pixel_code": "D5G8FTBC77UAODHQ0KOG",
  "event": "Purchase",
  "event_id": "Purchase_o20260503bcb3e46e789a1",
  "timestamp_source": "attribution_ledger.payment_success.logged_at",
  "properties": {
    "currency": "KRW",
    "value": 234000,
    "content_type": "product",
    "order_id": "202605032641706"
  },
  "context_preview": {
    "has_ttp": false,
    "has_ttclid": true,
    "has_user_agent": false,
    "has_ip": false,
    "raw_pii_included": false
  },
  "send_mode": "shadow_only",
  "send_candidate": false
}
```

### 후보 3

```json
{
  "order_no": "202605033205623",
  "order_code": "o20260502e40c789932ac1",
  "pixel_code": "D5G8FTBC77UAODHQ0KOG",
  "event": "Purchase",
  "event_id": "Purchase_o20260502e40c789932ac1",
  "timestamp_source": "attribution_ledger.payment_success.logged_at",
  "properties": {
    "currency": "KRW",
    "value": 156849,
    "content_type": "product",
    "order_id": "202605033205623"
  },
  "context_preview": {
    "has_ttp": false,
    "has_ttclid": true,
    "has_user_agent": false,
    "has_ip": false,
    "raw_pii_included": false
  },
  "send_mode": "shadow_only",
  "send_candidate": false
}
```

주의:
- 위 payload는 실제 TikTok payload가 아니라 preview다.
- 현재 preview에는 user agent/IP/_ttp가 없다.
- 따라서 Test Events 단계에서는 “수신과 event_id 구조 확인”까지만 목표로 둬야 한다.
- optimization signal 또는 match quality 판단으로 쓰면 안 된다.

## 외부 문서 근거

TikTok 공식 도움말 기준:
- Events API는 Pixel과 함께 쓸 수 있지만, 중복 전환을 막으려면 Pixel과 Events API가 같은 conversion을 보낼 때 event_id dedup이 필요하다. 참고: https://ads.tiktok.com/help/article/events-api
- TikTok은 동일 event와 event_id가 겹치는 이벤트를 dedup 대상으로 본다. Pixel과 Events API 간 중복은 5분 이후부터 48시간 window 안에서 처리되는 것으로 안내되어 있다. 참고: https://ads.tiktok.com/help/article?aid=10012410

이 문서의 적용:
- 그래서 server event_id 후보는 `Purchase_{order_code}`로 맞춘다.
- `event_id=o...`처럼 raw order_code만 보내는 방식은 금지한다.
- production send는 Test Events와 dedup 확인 전까지 Red Lane이다.

## No-Send / No-Write 확인

| 항목 | 결과 |
|---|---|
| TikTok Events API production send | NO, 하지 않음 |
| TikTok Test Events send | NO, 하지 않음 |
| GA4/Meta/Google send | NO, 하지 않음 |
| GTM change | NO, 하지 않음 |
| Purchase Guard change | NO, 하지 않음 |
| 개발팀 관리 운영DB PostgreSQL write | NO, 하지 않음 |
| VM SQLite write | NO, read-only 조회만 수행 |

## 다음 액션

데이터가 충분한가:
- candidate review 단계는 충분하다.
- production send 단계는 아직 부족하다.

더 조사할 것:
- Test Events code와 Events API token 권한 확인
- Test Events 화면에서 수신 여부 확인
- dedup diagnostics 확인

권장:
- Yellow Lane `TikTok Events API Test Events Only Smoke`를 별도 승인으로 진행한다.
- Production send는 계속 Red Lane으로 둔다.

## Auditor verdict

Auditor verdict: PASS_WITH_NOTES

Green Lane read-only 검토는 완료됐다.

다음 승인 게이트는 Test Events only다. production send는 아직 승인 요청 단계가 아니다.
