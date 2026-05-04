# TikTok Events API Shadow Candidate Rebuild v2.1 Result

작성 시각: 2026-05-04 14:41 KST
Project: TikTok ROAS 정합성 개선
Sprint: TikTok Events API Shadow Candidate Rebuild v2.1
Lane: Yellow
Mode: shadow-only VM SQLite rebuild
Auditor verdict: PASS
현재 판정: 승인 범위 안에서 완료. TikTok/GA4/Meta/Google 전송 0건
자신감: 96%

```yaml
harness_preflight:
  common_harness_read: "AGENTS.md, harness/common/HARNESS_GUIDELINES.md, harness/common/AUTONOMY_POLICY.md, harness/common/REPORTING_TEMPLATE.md"
  project_harness_read: "harness/tiktok/LESSONS.md"
  required_context_docs:
    - "docurule.md"
    - "frontrule.md"
    - "tiktok/tiktok_events_api_shadow_rebuild_result_20260504.md"
    - "tiktok/tiktok_events_api_shadow_candidate_review_20260504.md"
  lane: "Yellow"
  allowed_actions:
    - "synthetic test ttclid / manual test order exclusion 로직 추가"
    - "기존 v2 row 백업"
    - "새 candidate_version으로 최대 50건 shadow-only upsert"
    - "새 후보 검토표 작성"
    - "/ads/tiktok 및 문서에서 최신 candidate_version 기준 정리"
    - "audit"
    - "commit/push"
  forbidden_actions:
    - "TikTok Events API production send"
    - "TikTok Test Events send"
    - "GA4/Meta/Google 전환 전송"
    - "GTM 변경"
    - "Purchase Guard 변경"
    - "개발팀 관리 운영DB PostgreSQL write"
    - "firstTouch strict 승격"
    - "payment_success top-level attribution overwrite"
    - "scheduler/dispatcher ON"
  source_window_freshness_confidence:
    source: "TJ 관리 Attribution VM SQLite tiktok_pixel_events + attribution_ledger + tiktok_events_api_shadow_candidates"
    window: "최근 7일, sourceLimit=10000, selectedShadowRows=50"
    freshness: "2026-05-04 14:41 KST apply 직후"
    site: "biocom"
    confidence: 0.96
```

## 한 줄 결론

v2에서 유일하게 남았던 eligible 주문 `202605035698347 / 11,900원`은 실제 광고 주문이 아니라 TJ님과 Codex가 만든 TikTok 테스트 URL 카드 결제 주문이었다.

v2.1은 이 주문을 `manual_test_order`로 차단했다. 최신 `candidate_version=2026-05-04.shadow.rebuild.v2.1` 기준 production Events API send 후보는 **0건**이다.

## 완료한 것

| 항목 | 결과 | 근거 | 데이터/DB 위치 |
|---|---|---|---|
| manual/synthetic test exclusion 로직 | 완료 | `codex/test/smoke/vm_smoke/gtm_live` 계열과 known manual test order 차단 | 로컬 개발 코드 |
| technical/business eligible 분리 | 완료 | 기술적으로 dedup 가능해도 business 후보는 false 가능 | 로컬 개발 코드 + TJ 관리 Attribution VM SQLite metadata |
| 로컬 테스트 | 통과 | `npx tsx --test tests/tiktok-events-api-shadow-candidates.test.ts` 8/8 | 로컬 개발 DB 임시 SQLite |
| 로컬 typecheck | 통과 | `npm --prefix backend run typecheck -- --pretty false` | 해당 없음 |
| VM 파일/DB 백업 | 완료 | `/home/biocomkr_sns/seo/backups/20260504-0536-tiktok-shadow-rebuild-v21` | TJ 관리 Attribution VM |
| VM 테스트/typecheck | 통과 | 테스트 8/8, typecheck 0 error | TJ 관리 Attribution VM |
| v2 row 백업 | 완료 | `tiktok_events_api_shadow_candidates_backup_20260504_rebuild_v21` 50건 | TJ 관리 Attribution VM SQLite |
| v2.1 dry-run | 완료 | write 0건, business eligible 0건 | TJ 관리 Attribution VM SQLite read |
| v2.1 shadow upsert | 완료 | `candidate_version=2026-05-04.shadow.rebuild.v2.1` 50건 | TJ 관리 Attribution VM SQLite write |
| 새 후보 검토표 | 완료 | [[tiktok_events_api_shadow_candidate_review_20260504_v21]] | 문서 |

## Dry-Run / Apply 결과

| 지표 | 값 |
|---|---:|
| 전체 source 후보 | 499 |
| selected shadow rows | 50 |
| writtenRows | 50 |
| technical_eligible_for_future_send | 1 |
| business_eligible_for_future_send | 0 |
| eligible_for_future_send | 0 |
| manualTestOrders | 2 |
| syntheticEvidenceOrders | 2 |
| blocked | 499 |
| send_candidate=true | 0 |
| platform_send_status != not_sent | 0 |
| dedupReady | 1 |

Block reason 분포:

| block reason | 전체 후보 건수 |
|---|---:|
| no_tiktok_evidence | 498 |
| not_confirmed | 53 |
| pending_virtual_account | 48 |
| canceled_or_overdue | 9 |
| manual_test_order | 1 |
| synthetic_test_evidence | 1 |

## 핵심 주문 검토

| order_no | order_code | 금액 | technical_eligible | business_eligible | send_candidate | block_reason | is_manual_test_order | synthetic_evidence_reason | 사람이 보는 판정 |
|---|---|---:|---:|---:|---:|---|---:|---|---|
| 202605035698347 | o20260502c0c1ce5d28e95 | 11900 | 1 | 0 | 0 | manual_test_order | 1 | known_manual_test_order_no | 차단 정상. 실제 광고 주문이 아니라 테스트 URL 카드 결제 주문 |
| 202605036519253 | o202605033af504ba376d9 | 484500 | 0 | 0 | 0 | no_tiktok_evidence | 0 | - | 차단 정상. canary false-positive이며 주문 연결 TikTok evidence 없음 |

## Version Counts

| candidate_version | row count | eligible | send_candidate=true | platform violation | 해석 |
|---|---:|---:|---:|---:|---|
| 2026-05-03.shadow.v1 | 15 | 13 | 0 | 0 | 과거 false-positive 가능 버전. 승인 근거 금지 |
| 2026-05-04.shadow.rebuild.v2 | 1 | 0 | 0 | 0 | v2.1에 superseded. 승인 근거 금지 |
| 2026-05-04.shadow.rebuild.v2.1 | 50 | 0 | 0 | 0 | 최신 판단 기준. production send 후보 0건 |

## Hard Fail Checks

| Check | Result | 근거 |
|---|---|---|
| 모든 row send_candidate=false | PASS | v2.1 violation 0건 |
| 모든 row platform_send_status=not_sent | PASS | v2.1 violation 0건 |
| 기존 canary `202605036519253` eligible 금지 | PASS | `eligible_for_future_send=0`, `block_reason=no_tiktok_evidence` |
| 테스트 주문 `202605035698347` eligible 금지 | PASS | `eligible_for_future_send=0`, `block_reason=manual_test_order` |
| production send 후보 0건 | PASS | business eligible 0건 |
| raw `o...` event_id 저장 금지 | PASS | `guard_raw_event_id` / `source_refs.event_id` raw order id violation 0건 |
| raw/hash PII 저장 금지 | PASS | `pii_in_payload=0` |
| evidence present but link_type missing 금지 | PASS | violation 0건 |
| TikTok Events API production send 금지 | PASS | endpoint 호출 없음 |
| TikTok Test Events send 금지 | PASS | Test Events 호출 없음 |
| 개발팀 관리 운영DB PostgreSQL write 금지 | PASS | 운영DB 접속/write 없음 |

## 핵심 해석

이번 결과는 TikTok Events API를 확대할 근거가 아니라, 확대를 멈추는 근거다.

기술적으로는 `202605035698347`이 browser `Purchase_o...`와 server `Purchase_o...` dedup 형식이 맞고 TikTok evidence도 있다. 하지만 이 주문은 테스트 URL로 만든 카드 결제다. 따라서 `technical_eligible_for_future_send=1`이어도 `business_eligible_for_future_send=0`이어야 한다.

앞으로 `/ads/tiktok` 화면과 문서는 `candidate_version=2026-05-04.shadow.rebuild.v2.1`만 최신 근거로 본다. v1/v2는 보존은 하되 승인 근거로 쓰지 않는다.

## 변경 파일

| 파일 | 변경 내용 |
|---|---|
| `backend/src/tiktokEventsApiShadowCandidates.ts` | candidate version v2.1, manual/synthetic test exclusion, technical/business eligible 분리 |
| `backend/scripts/tiktok-events-api-shadow-candidates.ts` | dry-run/apply 출력에 technical/business/manual/synthetic 필드 추가 |
| `backend/tests/tiktok-events-api-shadow-candidates.test.ts` | 테스트 URL 주문과 synthetic ttclid 차단 회귀 테스트 추가 |
| `frontend/src/app/ads/tiktok/page.tsx` | `/ads/tiktok` 화면에 최신 Events API 후보 기준 v2.1과 production 후보 0건 목표 문구 추가 |
| `tiktok/tiktok_events_api_shadow_candidate_review_20260504_v21.md` | v2.1 후보 검토표 |
| `tiktok/!tiktokroasplan.md` | 최상단 최신 결론을 v2.1 기준으로 정정 |
| `harness/tiktok/LESSONS.md` | manual/synthetic test order는 production candidate에서 제외한다는 lesson 추가 |

## 남은 리스크

| 리스크 | 영향 | 대응 |
|---|---|---|
| v1에는 eligible row가 남아 있음 | 옛 버전을 잘못 보면 production 후보가 있는 것처럼 보일 수 있음 | 화면/문서/API에서 latest candidate_version만 근거로 쓴다 |
| production 후보 0건 | TikTok Events API 최적화 신호 보강을 지금은 할 수 없음 | 신규 실제 광고 주문이 생길 때까지 shadow-only 관찰 유지 |
| `global_intent_excluded_count=4801` | TikTok click intent는 많지만 주문에 직접 연결되지 않은 row가 많음 | marketing_intent는 주문 연결 없으면 evidence로 쓰지 않는 규칙 유지 |

## 다음 액션

| Lane | 옵션 | 추천도/자신감 | 담당 | 무엇을 하는가 | 왜 하는가 | Codex가 대신 가능한가 | 어떻게 하는가 | 어디에서 확인하나 | 성공 기준 | 실패 시 해석/대응 | 다른 에이전트 검증 | 승인 필요 |
|---|---|---:|---|---|---|---|---|---|---|---|---|---|
| Green | A | 92% | Codex | 24시간 후 v2.1 latest row와 TikTok Ads 플랫폼 구매값을 read-only로 다시 비교한다 | 실제 광고 주문이 새로 생겼는지 확인하기 위해서다 | YES | TJ 관리 Attribution VM SQLite read-only + TikTok Ads API read-only 조회 | `/ads/tiktok`, VM SQLite | business eligible 0이면 Events API 보류 유지 | 새 eligible이 생기면 manual/test 여부 먼저 검사 | 불필요 | NO |
| Yellow | B | 45% | TJ + Codex | 신규 실제 TikTok 광고 클릭 후 카드 결제 1건을 별도 테스트한다 | 현재 production 후보가 0건이라 Events API 확대 판단 표본이 부족하다 | NO. 실제 광고 클릭/결제는 TJ님 계정과 비용이 필요 | 별도 sprint 승인 후 같은 브라우저 실주문 테스트 | TikTok Ads Manager, VM SQLite | manual/test가 아닌 실제 ttclid 주문이 생김 | 여전히 0이면 TikTok 매출 기여 약함 | 권장 | YES |
| Red | C | 0% | TJ + Codex | TikTok Events API production send를 추가한다 | 현재 후보가 0건이라 전송하면 오염 위험만 있다 | NO | 별도 Red 승인 전 금지 | TikTok Events Manager | 해당 없음 | 실행하면 하네스 위반 | 권장 | YES |

## Auditor verdict

Auditor verdict: PASS

No-send verified: YES
No-platform-send verified: YES
No operating DB write verified: YES
No GTM change verified: YES
No Purchase Guard change verified: YES
VM SQLite write: YES, 승인된 shadow-only 50건 범위 안
