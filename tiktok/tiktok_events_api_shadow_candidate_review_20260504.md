# TikTok Events API Shadow Candidate Review 2026-05-04

작성 시각: 2026-05-04 14:09 KST
대상: TJ 관리 Attribution VM SQLite `CRM_LOCAL_DB_PATH#tiktok_events_api_shadow_candidates`
candidate_version: `2026-05-04.shadow.rebuild.v2`
운영DB 영향: 없음. 개발팀 관리 PostgreSQL `dashboard.public.tb_iamweb_users` write 없음
외부 전환 전송: 없음. TikTok Events API/Test Events/GA4/Meta/Google send 없음

```yaml
harness_preflight:
  common_harness_read: "AGENTS.md, harness/common/HARNESS_GUIDELINES.md, harness/common/AUTONOMY_POLICY.md, harness/common/REPORTING_TEMPLATE.md"
  project_harness_read: "harness/tiktok/LESSONS.md"
  lane: "Yellow"
  allowed_actions: "VM shadow-only upsert max 50, read-only review, docs, audit, commit/push"
  forbidden_actions: "TikTok/GA4/Meta/Google send, GTM change, Purchase Guard change, operating DB write"
  source_window_freshness_confidence:
    source: "TJ 관리 Attribution VM SQLite tiktok_pixel_events + attribution_ledger + tiktok_events_api_shadow_candidates"
    window: "최근 7일, sourceLimit=10000, selectedShadowRows=50"
    freshness: "2026-05-04 14:09 KST apply 직후"
    site: "biocom"
    confidence: 0.95
```

## 10초 요약

새 로직으로 shadow 후보 50건을 다시 만들었다. 50건 중 Events API 미래 후보로 남은 것은 1건뿐이고, 49건은 주문 연결 TikTok 증거가 없어 차단됐다. 기존 canary 주문 `202605036519253`은 새 로직에서 `no_tiktok_evidence`로 차단되어 Hard Fail 조건을 통과했다.

## Summary

| 항목 | 값 |
|---|---:|
| 새 version row | 50 |
| eligible_for_future_send | 1 |
| blocked | 49 |
| send_candidate=true | 0 |
| platform_send_status != not_sent | 0 |
| pii_in_payload violation | 0 |
| evidence present but link_type missing | 0 |
| canary 202605036519253 eligible | 0 |
| v1 backup row | 17 |

## Version Counts

| candidate_version | row count |
|---|---:|
| 2026-05-03.shadow.v1 | 15 |
| 2026-05-04.shadow.rebuild.v2 | 50 |

## 후보 검토표

| no | order_no | order_code | amount | payment_status | eligible_for_future_send | block_reason | TikTok evidence summary | event_id_candidate | server_event_id_pattern | pixel_event_stage / final guard stage | dedup_ready | source_refs 요약 | 사람이 보는 판정 | evidence_link_type | evidence_row_id | evidence_order_code_match | evidence_order_no_match | marketing_intent_linked | global_intent_excluded_count |
|---:|---|---|---:|---|---:|---|---|---|---|---|---:|---|---|---|---|---:|---:|---:|---:|
| 1 | 202605035698347 | o20260502c0c1ce5d28e95 | 11900 | confirmed | 1 | 없음 | ttclid,utm_source_tiktok; payment_success.ttclid | Purchase_o20260502c0c1ce5d28e95 | Purchase_<order_code> | released_confirmed_purchase / allow_purchase | 1 | pixel=6a7531fd1fc8:released_confirmed_purchase / payment_success=Y / evidence=payment_success.ttclid | A - Test Events 후보. production send는 별도 Red 승인 전 금지 | payment_success.ttclid | 8ae3e59dc021 | Y | Y | N | 4754 |
| 2 | 202605036519253 | o202605033af504ba376d9 | 484500 | confirmed | 0 | no_tiktok_evidence | none | Purchase_o202605033af504ba376d9 | Purchase_<order_code> | released_confirmed_purchase / allow_purchase | 0 | pixel=0e46d1a59ad7:released_confirmed_purchase / payment_success=Y / evidence=none | C - canary false-positive 차단 정상. 추가 전송 근거로 사용 금지 |  |  | N | N | N | 4754 |
| 3 | 202605037035925 | o202605038e6e7a46b155d | 234000 | confirmed | 0 | no_tiktok_evidence | none | Purchase_o202605038e6e7a46b155d | Purchase_<order_code> | released_unknown_purchase / hold_or_block_purchase | 0 | pixel=4ebd96ff7f18:released_unknown_purchase / payment_success=Y / evidence=none | 차단 정상 - 주문 연결 TikTok evidence 없음 |  |  | N | N | N | 4754 |
| 4 | 202605040435611 | o202605044ab5630402d7f | 159000 | confirmed | 0 | no_tiktok_evidence | none | Purchase_o202605044ab5630402d7f | Purchase_<order_code> | released_confirmed_purchase / allow_purchase | 0 | pixel=88cd8f11ccfd:released_confirmed_purchase / payment_success=Y / evidence=none | 차단 정상 - 주문 연결 TikTok evidence 없음 |  |  | N | N | N | 4754 |
| 5 | 202605041296971 | o20260504025d9a573f82a | 245000 | confirmed | 0 | no_tiktok_evidence | none | Purchase_o20260504025d9a573f82a | Purchase_<order_code> | released_unknown_purchase / hold_or_block_purchase | 0 | pixel=fb2bdc29ad41:released_unknown_purchase / payment_success=Y / evidence=none | 차단 정상 - 주문 연결 TikTok evidence 없음 |  |  | N | N | N | 4754 |
| 6 | 202605049147660 | o2026050484f449aebe7d4 | 234000 | confirmed | 0 | no_tiktok_evidence | none | Purchase_o2026050484f449aebe7d4 | Purchase_<order_code> | released_unknown_purchase / hold_or_block_purchase | 0 | pixel=b057c6651f04:released_unknown_purchase / payment_success=Y / evidence=none | 차단 정상 - 주문 연결 TikTok evidence 없음 |  |  | N | N | N | 4754 |
| 7 | 202605040904549 | o2026050470a8fa4715c89 | 675000 | confirmed | 0 | no_tiktok_evidence | none | Purchase_o2026050470a8fa4715c89 | Purchase_<order_code> | released_unknown_purchase / hold_or_block_purchase | 0 | pixel=171b8e81529e:released_unknown_purchase / payment_success=Y / evidence=none | 차단 정상 - 주문 연결 TikTok evidence 없음 |  |  | N | N | N | 4754 |
| 8 | 202605045077757 | o202605047a2d2ee0a6a4d | 875000 | confirmed | 0 | no_tiktok_evidence | none | Purchase_o202605047a2d2ee0a6a4d | Purchase_<order_code> | released_unknown_purchase / hold_or_block_purchase | 0 | pixel=82a1f5dd09c4:released_unknown_purchase / payment_success=Y / evidence=none | 차단 정상 - 주문 연결 TikTok evidence 없음 |  |  | N | N | N | 4754 |
| 9 | 202605042661789 | o2026050413edaf8144c43 | 459000 | confirmed | 0 | no_tiktok_evidence | none | Purchase_o2026050413edaf8144c43 | Purchase_<order_code> | released_unknown_purchase / hold_or_block_purchase | 0 | pixel=6d7c971b46aa:released_unknown_purchase / payment_success=Y / evidence=none | 차단 정상 - 주문 연결 TikTok evidence 없음 |  |  | N | N | N | 4754 |
| 10 | 202605041043028 | o20260504bbd61b9564815 | 245000 | confirmed | 0 | no_tiktok_evidence | none | Purchase_o20260504bbd61b9564815 | Purchase_<order_code> | released_unknown_purchase / hold_or_block_purchase | 0 | pixel=3689421c2b40:released_unknown_purchase / payment_success=Y / evidence=none | 차단 정상 - 주문 연결 TikTok evidence 없음 |  |  | N | N | N | 4754 |
| 11 | 202605043995794 | o20260504584372374ec7a | 234000 | canceled | 0 | canceled_or_overdue, not_confirmed, no_tiktok_evidence | none | Purchase_o20260504584372374ec7a | Purchase_<order_code> | released_unknown_purchase / hold_or_block_purchase | 0 | pixel=ba90bfbe6574:released_unknown_purchase / payment_success=Y / evidence=none | 차단 정상 - 취소/overdue 흐름 |  |  | N | N | N | 4754 |
| 12 | 202605040196850 | o20260504fc6c47afce7a5 | 245520 | confirmed | 0 | no_tiktok_evidence | none | Purchase_o20260504fc6c47afce7a5 | Purchase_<order_code> | released_unknown_purchase / hold_or_block_purchase | 0 | pixel=58a857901d91:released_unknown_purchase / payment_success=Y / evidence=none | 차단 정상 - 주문 연결 TikTok evidence 없음 |  |  | N | N | N | 4754 |
| 13 | 202605043013661 | o2026050422b2b8de27578 | 234000 | confirmed | 0 | no_tiktok_evidence | none | Purchase_o2026050422b2b8de27578 | Purchase_<order_code> | released_unknown_purchase / hold_or_block_purchase | 0 | pixel=8948c8ec3431:released_unknown_purchase / payment_success=Y / evidence=none | 차단 정상 - 주문 연결 TikTok evidence 없음 |  |  | N | N | N | 4754 |
| 14 | 202605046926398 | o20260504a893a5c80eee0 | 40788 | confirmed | 0 | no_tiktok_evidence | none | Purchase_o20260504a893a5c80eee0 | Purchase_<order_code> | released_unknown_purchase / hold_or_block_purchase | 0 | pixel=5bc7925637d0:released_unknown_purchase / payment_success=Y / evidence=none | 차단 정상 - 주문 연결 TikTok evidence 없음 |  |  | N | N | N | 4754 |
| 15 | 202605049748951 | o202605045fc31f67d9706 | 313500 | confirmed | 0 | no_tiktok_evidence | none | Purchase_o202605045fc31f67d9706 | Purchase_<order_code> | released_unknown_purchase / hold_or_block_purchase | 0 | pixel=cd49980878e7:released_unknown_purchase / payment_success=Y / evidence=none | 차단 정상 - 주문 연결 TikTok evidence 없음 |  |  | N | N | N | 4754 |
| 16 | 202605049919875 | o2026050467c8ac7dd3c5c | 260000 | confirmed | 0 | no_tiktok_evidence | none | Purchase_o2026050467c8ac7dd3c5c | Purchase_<order_code> | released_unknown_purchase / hold_or_block_purchase | 0 | pixel=c64844d4d340:released_unknown_purchase / payment_success=Y / evidence=none | 차단 정상 - 주문 연결 TikTok evidence 없음 |  |  | N | N | N | 4754 |
| 17 | 202605041690398 | o202605046b5bff9ade32a | 0 | pending | 0 | not_confirmed, no_tiktok_evidence | none | Purchase_o202605046b5bff9ade32a | Purchase_<order_code> | released_unknown_purchase / hold_or_block_purchase | 0 | pixel=2be0e7665e1f:released_unknown_purchase / payment_success=Y / evidence=none | 차단 정상 - confirmed 결제 아님 |  |  | N | N | N | 4754 |
| 18 | 202605046111540 | o2026050433a7014fbe75c | 0 | pending | 0 | not_confirmed, no_tiktok_evidence | none | Purchase_o2026050433a7014fbe75c | Purchase_<order_code> | released_unknown_purchase / hold_or_block_purchase | 0 | pixel=308064dda3ac:released_unknown_purchase / payment_success=Y / evidence=none | 차단 정상 - confirmed 결제 아님 |  |  | N | N | N | 4754 |
| 19 | 202605042731558 | o2026050470ca58aeb559d | 234000 | confirmed | 0 | no_tiktok_evidence | none | Purchase_o2026050470ca58aeb559d | Purchase_<order_code> | decision_received / hold_or_block_purchase | 0 | pixel=0dc6087532fd:decision_received / payment_success=Y / evidence=none | 차단 정상 - 주문 연결 TikTok evidence 없음 |  |  | N | N | N | 4754 |
| 20 | 202605043151728 | o2026050440076de4c38b7 | 245000 | confirmed | 0 | no_tiktok_evidence | none | Purchase_o2026050440076de4c38b7 | Purchase_<order_code> | released_confirmed_purchase / allow_purchase | 0 | pixel=1e8224afdd9a:released_confirmed_purchase / payment_success=Y / evidence=none | 차단 정상 - 주문 연결 TikTok evidence 없음 |  |  | N | N | N | 4754 |
| 21 | 202605040577635 | o2026050493abbaf1d2f6b | 0 | pending | 0 | not_confirmed, no_tiktok_evidence | none | Purchase_o2026050493abbaf1d2f6b | Purchase_<order_code> | released_unknown_purchase / hold_or_block_purchase | 0 | pixel=11c23c640a5f:released_unknown_purchase / payment_success=Y / evidence=none | 차단 정상 - confirmed 결제 아님 |  |  | N | N | N | 4754 |
| 22 | 202605044175799 | o20260504ad8cc875045fb | 462000 | confirmed | 0 | no_tiktok_evidence | none | Purchase_o20260504ad8cc875045fb | Purchase_<order_code> | released_unknown_purchase / hold_or_block_purchase | 0 | pixel=f7c430d54ab8:released_unknown_purchase / payment_success=Y / evidence=none | 차단 정상 - 주문 연결 TikTok evidence 없음 |  |  | N | N | N | 4754 |
| 23 | 202605049438880 | o20260504d2bbe46b4cc4a | 52962 | pending | 0 | not_confirmed, no_tiktok_evidence | none | Purchase_o20260504d2bbe46b4cc4a | Purchase_<order_code> | purchase_intercepted / unknown | 0 | pixel=ad4266a5fa11:purchase_intercepted / payment_success=Y / evidence=none | 차단 정상 - confirmed 결제 아님 |  |  | N | N | N | 4754 |
| 24 | 202605041230495 | o20260504e14c8509f2e48 | 19935 | confirmed | 0 | no_tiktok_evidence | none | Purchase_o20260504e14c8509f2e48 | Purchase_<order_code> | released_unknown_purchase / hold_or_block_purchase | 0 | pixel=04eaf53fe147:released_unknown_purchase / payment_success=Y / evidence=none | 차단 정상 - 주문 연결 TikTok evidence 없음 |  |  | N | N | N | 4754 |
| 25 | 202605046469729 | o20260504c4326865473b8 | 245000 | confirmed | 0 | no_tiktok_evidence | none | Purchase_o20260504c4326865473b8 | Purchase_<order_code> | released_unknown_purchase / hold_or_block_purchase | 0 | pixel=0d2e284b13e8:released_unknown_purchase / payment_success=Y / evidence=none | 차단 정상 - 주문 연결 TikTok evidence 없음 |  |  | N | N | N | 4754 |
| 26 | 202605046835457 | o2026050448be1ec379d36 | 245000 | confirmed | 0 | no_tiktok_evidence | none | Purchase_o2026050448be1ec379d36 | Purchase_<order_code> | released_unknown_purchase / hold_or_block_purchase | 0 | pixel=2f647d88acec:released_unknown_purchase / payment_success=Y / evidence=none | 차단 정상 - 주문 연결 TikTok evidence 없음 |  |  | N | N | N | 4754 |
| 27 | 202605047980493 | o20260504f8fdd4a6da444 | 675000 | confirmed | 0 | no_tiktok_evidence | none | Purchase_o20260504f8fdd4a6da444 | Purchase_<order_code> | decision_received / hold_or_block_purchase | 0 | pixel=1594ef611fdd:decision_received / payment_success=Y / evidence=none | 차단 정상 - 주문 연결 TikTok evidence 없음 |  |  | N | N | N | 4754 |
| 28 | 202605048416297 | o2026050477f628d2b165d | 245000 | confirmed | 0 | no_tiktok_evidence | none | Purchase_o2026050477f628d2b165d | Purchase_<order_code> | decision_received / hold_or_block_purchase | 0 | pixel=fb2361733ff2:decision_received / payment_success=Y / evidence=none | 차단 정상 - 주문 연결 TikTok evidence 없음 |  |  | N | N | N | 4754 |
| 29 | 202605045866635 | o20260504420e6c1298d12 | 476000 | confirmed | 0 | no_tiktok_evidence | none | Purchase_o20260504420e6c1298d12 | Purchase_<order_code> | released_unknown_purchase / hold_or_block_purchase | 0 | pixel=30f6c67b0866:released_unknown_purchase / payment_success=Y / evidence=none | 차단 정상 - 주문 연결 TikTok evidence 없음 |  |  | N | N | N | 4754 |
| 30 | 202605049269215 | o20260504bfc429cb14836 | 484500 | confirmed | 0 | no_tiktok_evidence | none | Purchase_o20260504bfc429cb14836 | Purchase_<order_code> | released_unknown_purchase / hold_or_block_purchase | 0 | pixel=b98ac3ab5aa0:released_unknown_purchase / payment_success=Y / evidence=none | 차단 정상 - 주문 연결 TikTok evidence 없음 |  |  | N | N | N | 4754 |
| 31 | 202605046108109 | o20260504ac6c1a6bb001d | 234000 | confirmed | 0 | no_tiktok_evidence | none | Purchase_o20260504ac6c1a6bb001d | Purchase_<order_code> | released_unknown_purchase / hold_or_block_purchase | 0 | pixel=5cc68c3bd142:released_unknown_purchase / payment_success=Y / evidence=none | 차단 정상 - 주문 연결 TikTok evidence 없음 |  |  | N | N | N | 4754 |
| 32 | 202605041250436 | o202605044d4dd9a024552 | 107000 | confirmed | 0 | no_tiktok_evidence | none | Purchase_o202605044d4dd9a024552 | Purchase_<order_code> | released_unknown_purchase / hold_or_block_purchase | 0 | pixel=50996b95ef2f:released_unknown_purchase / payment_success=Y / evidence=none | 차단 정상 - 주문 연결 TikTok evidence 없음 |  |  | N | N | N | 4754 |
| 33 | 202605040091834 | o202605047b43e38422126 | 99000 | confirmed | 0 | no_tiktok_evidence | none | Purchase_o202605047b43e38422126 | Purchase_<order_code> | decision_received / hold_or_block_purchase | 0 | pixel=23c117858699:decision_received / payment_success=Y / evidence=none | 차단 정상 - 주문 연결 TikTok evidence 없음 |  |  | N | N | N | 4754 |
| 34 | 202605047666433 | o202605041ea2976051279 | 459000 | confirmed | 0 | no_tiktok_evidence | none | Purchase_o202605041ea2976051279 | Purchase_<order_code> | released_unknown_purchase / hold_or_block_purchase | 0 | pixel=abbc74c92fbc:released_unknown_purchase / payment_success=Y / evidence=none | 차단 정상 - 주문 연결 TikTok evidence 없음 |  |  | N | N | N | 4754 |
| 35 | 202605043203971 | o202605040b466158f5532 | 245000 | confirmed | 0 | no_tiktok_evidence | none | Purchase_o202605040b466158f5532 | Purchase_<order_code> | released_unknown_purchase / hold_or_block_purchase | 0 | pixel=80155bbea5ba:released_unknown_purchase / payment_success=Y / evidence=none | 차단 정상 - 주문 연결 TikTok evidence 없음 |  |  | N | N | N | 4754 |
| 36 | 202605049636969 | o20260504c9f09e8e097f4 | 459000 | confirmed | 0 | no_tiktok_evidence | none | Purchase_o20260504c9f09e8e097f4 | Purchase_<order_code> | decision_received / hold_or_block_purchase | 0 | pixel=b8c999d35ce0:decision_received / payment_success=Y / evidence=none | 차단 정상 - 주문 연결 TikTok evidence 없음 |  |  | N | N | N | 4754 |
| 37 | 202605043921722 | o20260504ec79d1a180704 | 234000 | confirmed | 0 | no_tiktok_evidence | none | Purchase_o20260504ec79d1a180704 | Purchase_<order_code> | released_unknown_purchase / hold_or_block_purchase | 0 | pixel=c1ac1571474f:released_unknown_purchase / payment_success=Y / evidence=none | 차단 정상 - 주문 연결 TikTok evidence 없음 |  |  | N | N | N | 4754 |
| 38 | 202605040897091 | o20260504047171a7c06cf | 245000 | confirmed | 0 | no_tiktok_evidence | none | Purchase_o20260504047171a7c06cf | Purchase_<order_code> | decision_received / hold_or_block_purchase | 0 | pixel=cbe90a1503b3:decision_received / payment_success=Y / evidence=none | 차단 정상 - 주문 연결 TikTok evidence 없음 |  |  | N | N | N | 4754 |
| 39 | 202605043402775 | o202605039ef85c01e67ae | 106800 | confirmed | 0 | no_tiktok_evidence | none | Purchase_o202605039ef85c01e67ae | Purchase_<order_code> | released_unknown_purchase / hold_or_block_purchase | 0 | pixel=4a96426af52b:released_unknown_purchase / payment_success=Y / evidence=none | 차단 정상 - 주문 연결 TikTok evidence 없음 |  |  | N | N | N | 4754 |
| 40 | 202605040358471 | o20260503a61cbaa215ec3 | 470220 | confirmed | 0 | no_tiktok_evidence | none | Purchase_o20260503a61cbaa215ec3 | Purchase_<order_code> | decision_received / allow_purchase | 0 | pixel=3491a1cc43de:decision_received / payment_success=Y / evidence=none | 차단 정상 - 주문 연결 TikTok evidence 없음 |  |  | N | N | N | 4754 |
| 41 | 202605042439643 | o2026050345c8c729578f7 | 245000 | confirmed | 0 | no_tiktok_evidence | none | Purchase_o2026050345c8c729578f7 | Purchase_<order_code> | decision_received / hold_or_block_purchase | 0 | pixel=c15fff58f89f:decision_received / payment_success=Y / evidence=none | 차단 정상 - 주문 연결 TikTok evidence 없음 |  |  | N | N | N | 4754 |
| 42 | 202605043601258 | o202605039d6b9cb9a40b0 | 245000 | confirmed | 0 | no_tiktok_evidence | none | Purchase_o202605039d6b9cb9a40b0 | Purchase_<order_code> | released_unknown_purchase / hold_or_block_purchase | 0 | pixel=56a8e3f0dea4:released_unknown_purchase / payment_success=Y / evidence=none | 차단 정상 - 주문 연결 TikTok evidence 없음 |  |  | N | N | N | 4754 |
| 43 | 202605046083737 | o202605036f67868f4cca0 | 117800 | confirmed | 0 | no_tiktok_evidence | none | Purchase_o202605036f67868f4cca0 | Purchase_<order_code> | released_unknown_purchase / hold_or_block_purchase | 0 | pixel=090ff923c042:released_unknown_purchase / payment_success=Y / evidence=none | 차단 정상 - 주문 연결 TikTok evidence 없음 |  |  | N | N | N | 4754 |
| 44 | 202605032273136 | o202605037409a6478f2bc | 21900 | confirmed | 0 | no_tiktok_evidence | none | Purchase_o202605037409a6478f2bc | Purchase_<order_code> | released_unknown_purchase / hold_or_block_purchase | 0 | pixel=14f1c6d1e367:released_unknown_purchase / payment_success=Y / evidence=none | 차단 정상 - 주문 연결 TikTok evidence 없음 |  |  | N | N | N | 4754 |
| 45 | 202605031473358 | o20260503cecb50a3b9ec0 | 260000 | confirmed | 0 | no_tiktok_evidence | none | Purchase_o20260503cecb50a3b9ec0 | Purchase_<order_code> | decision_received / hold_or_block_purchase | 0 | pixel=c58e11790005:decision_received / payment_success=Y / evidence=none | 차단 정상 - 주문 연결 TikTok evidence 없음 |  |  | N | N | N | 4754 |
| 46 | 202605034346901 | o202605035375cd58227b2 | 459000 | confirmed | 0 | no_tiktok_evidence | none | Purchase_o202605035375cd58227b2 | Purchase_<order_code> | released_unknown_purchase / hold_or_block_purchase | 0 | pixel=b8424e151927:released_unknown_purchase / payment_success=Y / evidence=none | 차단 정상 - 주문 연결 TikTok evidence 없음 |  |  | N | N | N | 4754 |
| 47 | 202605033040341 | o202605039d86e2cd8defc | 245000 | confirmed | 0 | no_tiktok_evidence | none | Purchase_o202605039d86e2cd8defc | Purchase_<order_code> | released_confirmed_purchase / allow_purchase | 0 | pixel=9637b3ff4d8a:released_confirmed_purchase / payment_success=Y / evidence=none | 차단 정상 - 주문 연결 TikTok evidence 없음 |  |  | N | N | N | 4754 |
| 48 | 202605038994202 | o20260503b5df40acbcee4 | 471200 | confirmed | 0 | no_tiktok_evidence | none | Purchase_o20260503b5df40acbcee4 | Purchase_<order_code> | released_unknown_purchase / hold_or_block_purchase | 0 | pixel=836f27eab863:released_unknown_purchase / payment_success=Y / evidence=none | 차단 정상 - 주문 연결 TikTok evidence 없음 |  |  | N | N | N | 4754 |
| 49 | 202605033153818 | o202605033611216739f73 | 234000 | confirmed | 0 | no_tiktok_evidence | none | Purchase_o202605033611216739f73 | Purchase_<order_code> | released_unknown_purchase / hold_or_block_purchase | 0 | pixel=2550d5fd4f54:released_unknown_purchase / payment_success=Y / evidence=none | 차단 정상 - 주문 연결 TikTok evidence 없음 |  |  | N | N | N | 4754 |
| 50 | 202605038409156 | o20260503a3fdf59624746 | 260000 | confirmed | 0 | no_tiktok_evidence | none | Purchase_o20260503a3fdf59624746 | Purchase_<order_code> | released_unknown_purchase / hold_or_block_purchase | 0 | pixel=4405b27e1af0:released_unknown_purchase / payment_success=Y / evidence=none | 차단 정상 - 주문 연결 TikTok evidence 없음 |  |  | N | N | N | 4754 |

## Hard Fail Checks

| Check | Result | 근거 |
|---|---|---|
| canary 202605036519253 eligible=true 금지 | PASS | eligible 0, block_reason no_tiktok_evidence |
| unrelated marketing_intent evidence 사용 금지 | PASS | marketing_intent_linked Y row 0건 |
| source_refs_json에 order link 없는 evidence 금지 | PASS | linked_refs without order/payment match 0건 |
| evidence_link_type 없이 TikTok evidence 금지 | PASS | 0건 |
| send_candidate=false 유지 | PASS | send_candidate violation 0건 |
| platform_send_status=not_sent 유지 | PASS | violation 0건 |

## Auditor verdict

Auditor verdict: PASS_WITH_NOTES

Notes: shadow-only rebuild는 성공했다. 다만 최근 7일 전체 502개 후보 중 501건이 `no_tiktok_evidence`로 막혔다는 것은 TikTok Pixel Purchase가 사이트 전체 결제완료 이벤트에 붙어 있을 뿐, 내부 Events API로 보낼 만한 TikTok 주문 근거는 거의 없다는 뜻이다. production send 확장은 여전히 Red Lane이다.
