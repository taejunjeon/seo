# TikTok Events API Shadow Candidate Review v2.1

작성 시각: 2026-05-04 14:41 KST
대상: TJ 관리 Attribution VM SQLite `CRM_LOCAL_DB_PATH#tiktok_events_api_shadow_candidates`
candidate_version: `2026-05-04.shadow.rebuild.v2.1`
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
    freshness: "2026-05-04 14:41 KST apply 직후"
    site: "biocom"
    confidence: 0.96
```

## 10초 요약

v2.1 최신 후보 50건 중 production Events API 후보는 0건이다.

이전 v2에서 유일하게 남았던 eligible 주문 `202605035698347`은 테스트 URL 카드 결제 주문으로 확인되어 `manual_test_order`로 차단했다. 기존 canary 주문 `202605036519253`은 계속 `no_tiktok_evidence`로 차단한다.

## Summary

| 항목 | 값 |
|---|---:|
| 새 version row | 50 |
| technical_eligible_for_future_send | 1 |
| business_eligible_for_future_send | 0 |
| eligible_for_future_send | 0 |
| send_candidate=true | 0 |
| platform_send_status != not_sent | 0 |
| manual_test_order | 1 |
| synthetic_test_evidence | 0 |
| pii_in_payload violation | 0 |
| evidence present but link_type missing | 0 |
| canary 202605036519253 eligible | 0 |
| test order 202605035698347 eligible | 0 |

## Version Counts

| candidate_version | row count | eligible | 사용 여부 |
|---|---:|---:|---|
| 2026-05-03.shadow.v1 | 15 | 13 | 승인 근거 금지 |
| 2026-05-04.shadow.rebuild.v2 | 1 | 0 | v2.1에 의해 superseded |
| 2026-05-04.shadow.rebuild.v2.1 | 50 | 0 | 최신 판단 기준 |

## 후보 검토표

아래 표는 의사결정에 필요한 핵심 row와 대표 표본이다. 전체 50건은 TJ 관리 Attribution VM SQLite의 최신 `candidate_version=2026-05-04.shadow.rebuild.v2.1` row로 보존되어 있다.

| no | order_no | order_code | amount | payment_status | technical_eligible_for_future_send | business_eligible_for_future_send | send_candidate | block_reason | is_manual_test_order | synthetic_evidence_reason | TikTok evidence summary | event_id_candidate | pixel_event_stage / final guard stage | dedup_ready | evidence_link_type | evidence_row_id | evidence_order_code_match | evidence_order_no_match | marketing_intent_linked | global_intent_excluded_count | 사람이 보는 판정 |
|---:|---|---|---:|---|---:|---:|---:|---|---:|---|---|---|---|---:|---|---|---:|---:|---:|---:|---|
| 1 | 202605035698347 | o20260502c0c1ce5d28e95 | 11900 | confirmed | 1 | 0 | 0 | manual_test_order | 1 | known_manual_test_order_no | ttclid,utm_source_tiktok | Purchase_o20260502c0c1ce5d28e95 | released_confirmed_purchase / allow_purchase | 1 | payment_success.ttclid | 8ae3e59dc021 | 1 | 1 | 0 | 4801 | 차단 정상 - 수동/합성 테스트 주문 |
| 2 | 202605036519253 | o202605033af504ba376d9 | 484500 | confirmed | 0 | 0 | 0 | no_tiktok_evidence | 0 | - | none | Purchase_o202605033af504ba376d9 | released_confirmed_purchase / allow_purchase | 0 | - | - | 0 | 0 | 0 | 4801 | 차단 정상 - canary false-positive |
| 3 | 202605037035925 | o202605038e6e7a46b155d | 234000 | confirmed | 0 | 0 | 0 | no_tiktok_evidence | 0 | - | none | Purchase_o202605038e6e7a46b155d | released_unknown_purchase / hold_or_block_purchase | 0 | - | - | 0 | 0 | 0 | 4801 | 차단 정상 - 주문 연결 TikTok evidence 없음 |
| 4 | 202605040435611 | o202605044ab5630402d7f | 159000 | confirmed | 0 | 0 | 0 | no_tiktok_evidence | 0 | - | none | Purchase_o202605044ab5630402d7f | released_confirmed_purchase / allow_purchase | 0 | - | - | 0 | 0 | 0 | 4801 | 차단 정상 - 주문 연결 TikTok evidence 없음 |
| 5 | 202605041296971 | o20260504025d9a573f82a | 245000 | confirmed | 0 | 0 | 0 | no_tiktok_evidence | 0 | - | none | Purchase_o20260504025d9a573f82a | released_unknown_purchase / hold_or_block_purchase | 0 | - | - | 0 | 0 | 0 | 4801 | 차단 정상 - 주문 연결 TikTok evidence 없음 |
| 6 | 202605049147660 | o2026050484f449aebe7d4 | 234000 | confirmed | 0 | 0 | 0 | no_tiktok_evidence | 0 | - | none | Purchase_o2026050484f449aebe7d4 | released_unknown_purchase / hold_or_block_purchase | 0 | - | - | 0 | 0 | 0 | 4801 | 차단 정상 - 주문 연결 TikTok evidence 없음 |
| 7 | 202605047969725 | o20260504f497a4c9fccd6 | 0 | pending | 0 | 0 | 0 | not_confirmed, no_tiktok_evidence | 0 | - | none | Purchase_o20260504f497a4c9fccd6 | decision_received / hold_or_block_purchase | 0 | - | - | 0 | 0 | 0 | 4801 | 차단 정상 - confirmed 결제 아님 |
| 8 | 202605043995794 | o20260504584372374ec7a | 234000 | canceled | 0 | 0 | 0 | canceled_or_overdue, not_confirmed, no_tiktok_evidence | 0 | - | none | Purchase_o20260504584372374ec7a | released_unknown_purchase / hold_or_block_purchase | 0 | - | - | 0 | 0 | 0 | 4801 | 차단 정상 - 취소/overdue |
| 9 | 202605040904549 | o2026050470a8fa4715c89 | 675000 | confirmed | 0 | 0 | 0 | no_tiktok_evidence | 0 | - | none | Purchase_o2026050470a8fa4715c89 | released_unknown_purchase / hold_or_block_purchase | 0 | - | - | 0 | 0 | 0 | 4801 | 차단 정상 - 주문 연결 TikTok evidence 없음 |
| 10 | 202605045077757 | o202605047a2d2ee0a6a4d | 875000 | confirmed | 0 | 0 | 0 | no_tiktok_evidence | 0 | - | none | Purchase_o202605047a2d2ee0a6a4d | released_unknown_purchase / hold_or_block_purchase | 0 | - | - | 0 | 0 | 0 | 4801 | 차단 정상 - 주문 연결 TikTok evidence 없음 |
| 11 | 202605042661789 | o2026050413edaf8144c43 | 459000 | confirmed | 0 | 0 | 0 | no_tiktok_evidence | 0 | - | none | Purchase_o2026050413edaf8144c43 | released_unknown_purchase / hold_or_block_purchase | 0 | - | - | 0 | 0 | 0 | 4801 | 차단 정상 - 주문 연결 TikTok evidence 없음 |
| 12 | 202605041043028 | o20260504bbd61b9564815 | 245000 | confirmed | 0 | 0 | 0 | no_tiktok_evidence | 0 | - | none | Purchase_o20260504bbd61b9564815 | released_unknown_purchase / hold_or_block_purchase | 0 | - | - | 0 | 0 | 0 | 4801 | 차단 정상 - 주문 연결 TikTok evidence 없음 |

## 사람 기준 등급 분류

| 등급 | 건수 | 설명 |
|---|---:|---|
| A: Test Events 후보로 가장 안전 | 0 | 실제 광고 주문이며 dedup/evidence가 모두 맞는 후보 없음 |
| B: 추가 확인 후 후보 | 0 | technical 가능하지만 business 보류할 후보 없음 |
| C: production send 후보로 약함/차단 | 50 | no_tiktok_evidence, pending/canceled, manual test order 등 |

## 차단 row deep dive

| 주문 | 차단 이유 | 정상 여부 | 재평가 조건 |
|---|---|---|---|
| 202605035698347 | 테스트 URL 카드 결제 주문. technical dedup은 맞지만 실제 광고 주문이 아님 | 정상 | 실제 광고 클릭/캠페인에서 발생한 새 confirmed 주문이 따로 생길 때만 재평가 |
| 202605036519253 | canary false-positive. 주문별 TikTok evidence 없음 | 정상 | payment_success 또는 checkout_started에 주문 연결 ttclid/TikTok UTM이 새로 확인될 때만 재평가 |
| 나머지 48건 | 대부분 주문 연결 TikTok evidence 없음. 일부 pending/canceled 포함 | 정상 | 주문별 evidence_link_type과 row_id가 생길 때만 재평가 |

## Test Events / Production 판단

Test Events 추가 전송은 하지 않는다.

이유는 이미 Test Events 수신 가능성은 확인됐고, v2.1 기준 A등급 후보가 0건이기 때문이다. production send는 Red Lane이며 현재 추천도는 0%다.

## Auditor verdict

Auditor verdict: PASS

No-send verified: YES
No-platform-send verified: YES
No operating DB write verified: YES
No GTM change verified: YES
No Purchase Guard change verified: YES

Notes: 후보표의 핵심은 `technical_eligible_for_future_send`와 `business_eligible_for_future_send`를 분리한 것이다. 테스트 주문은 기술적으로 dedup 가능해도 business 후보가 아니다.
