# TikTok Events API Shadow Missed-Order Audit

작성 시각: 2026-05-04 15:20 KST
대상: TJ 관리 Attribution VM SQLite
candidate_version: `2026-05-04.shadow.rebuild.v2.1`
Lane: Green
Mode: read-only missed-order audit
Auditor verdict: PASS
현재 판정: production Events API 후보 0건 결론 유지
자신감: 91%

```yaml
harness_preflight:
  common_harness_read:
    - "AGENTS.md"
    - "harness/common/HARNESS_GUIDELINES.md"
    - "harness/common/AUTONOMY_POLICY.md"
    - "harness/common/REPORTING_TEMPLATE.md"
  required_context_docs:
    - "docurule.md"
    - "tiktok/tiktok_events_api_shadow_rebuild_v21_result_20260504.md"
    - "tiktok/tiktok_events_api_shadow_candidate_review_20260504_v21.md"
  lane: "Green"
  allowed_actions:
    - "TJ 관리 Attribution VM SQLite read-only 조회"
    - "GA4 Data API read-only cross-check"
    - "문서 업데이트"
    - "audit"
    - "commit/push"
  forbidden_actions:
    - "TikTok Events API production send"
    - "TikTok Test Events send"
    - "GA4/Meta/Google 전환 전송"
    - "GTM 변경"
    - "Purchase Guard 변경"
    - "개발팀 관리 운영DB PostgreSQL write"
    - "VM SQLite 신규 write"
    - "firstTouch strict 승격"
  source_window_freshness_confidence:
    primary_source: "TJ 관리 Attribution VM SQLite: tiktok_pixel_events + attribution_ledger"
    cross_check_source: "GA4 Data API read-only, /api/ads/tiktok/roas-comparison"
    window: "최근 7일, generatedAt=2026-05-04T06:09:38Z, startAt=2026-04-27T06:09:38Z"
    site: "biocom"
    source_limit: 10000
    selected_shadow_rows: 50
    confidence: 0.91
```

## 10초 결론

v2.1 기준 production TikTok Events API send 후보는 여전히 **0건**이다.

전체 source 후보 502건을 다시 보니 `technical_eligible_for_future_send=1`은 테스트 주문 `202605035698347 / 11,900원` 하나뿐이고, 이 주문은 `manual_test_order`로 business 후보에서 정상 차단됐다. 실제 운영 주문 중 “TikTok evidence를 너무 엄격해서 놓친” 강한 후보는 발견하지 못했다.

## Full Source Population Audit

아래 숫자는 TJ 관리 Attribution VM에서 후보 생성 로직을 dry-run으로 다시 실행한 값이다. VM SQLite에는 새 row를 쓰지 않았다.

| 항목 | 값 | 해석 |
|---|---:|---|
| 전체 source 후보 | 502 | 최근 7일 `tiktok_pixel_events` Purchase 그룹 |
| technical_eligible_for_future_send | 1 | dedup 형식과 confirmed 조건만 보면 가능한 후보 |
| business_eligible_for_future_send | 0 | 실제 production send 후보 |
| eligible_for_future_send | 0 | send 후보 없음 |
| blocked | 502 | 모든 후보가 차단됨 |
| dedupReady | 1 | dedup 가능 1건은 테스트 주문 |
| manualTestOrders | 2 | 테스트/합성 신호로 표시된 후보 |
| syntheticEvidenceOrders | 2 | synthetic evidence reason 보유 후보 |
| send_candidate=true | 0 | PASS |
| platformSent | 0 | PASS |

Block reason 분포:

| block reason | 건수 | 해석 |
|---|---:|---|
| no_tiktok_evidence | 501 | 주문에 직접 연결된 TikTok 근거 없음 |
| not_confirmed | 56 | confirmed 결제가 아님 |
| pending_virtual_account | 48 | 가상계좌 pending 차단 |
| canceled_or_overdue | 9 | 취소/입금기한 만료 |
| manual_test_order | 1 | known manual test order |
| synthetic_test_evidence | 1 | 테스트 문자열 기반 차단 |

Payment status 분포:

| payment_status | 건수 |
|---|---:|
| confirmed | 446 |
| pending | 47 |
| canceled | 9 |

TikTok evidence type 분포:

| evidence type | 건수 |
|---|---:|
| `(none)` | 501 |
| `ttclid,utm_source_tiktok` | 1 |

주의: 직전 v2.1 문서의 499건과 이번 502건 차이는 rolling 7일 window가 몇십 분 지나며 경계 주문이 드나든 영향이다. 최신 감사 기준은 `2026-05-04 15:09 KST` dry-run의 502건이다.

## Missed-Order Audit

### 사람이 오해하기 쉬운 지점

TikTok Pixel의 `released_confirmed_purchase`는 “결제가 confirmed라서 브라우저 Purchase를 허용했다”는 뜻이지, “TikTok 광고에서 온 주문”이라는 뜻이 아니다. 전체 결제완료 페이지에 TikTok Pixel이 붙어 있으므로 Meta/Naver/직접유입 주문도 confirmed이면 `released_confirmed_purchase`가 찍힌다.

그래서 v2.1은 아래처럼 본다.

| 조건 | production send 근거로 인정? | 이유 |
|---|---|---|
| `released_confirmed_purchase`만 있음 | NO | 결제 상태 근거이지 TikTok 유입 근거가 아님 |
| 같은 주문의 checkout_started 있음 | NO | checkout에 TikTok UTM/ttclid가 없으면 TikTok 근거 아님 |
| 같은 `ga_session_id`에 marketing_intent 있음 | 단독으로 NO | GA session id는 timestamp 성격이라 client id까지 맞아야 함 |
| 같은 `ga_session_id + client_id`의 TikTok marketing_intent 있음 | 후보 가능 | 단, 테스트 주문/합성 URL이면 차단 |
| payment_success top-level ttclid/TikTok UTM 있음 | 후보 가능 | 주문 직접 근거로 가장 강함 |

### Confirmed but no TikTok evidence 재검토

read-only 상세 감사 결과:

| 항목 | 건수 | 해석 |
|---|---:|---|
| confirmed + no_tiktok_evidence 후보 | 445 | 결제는 confirmed지만 주문 직접 TikTok evidence 없음 |
| 그중 `released_confirmed_purchase` 포함 | 255 | 결제 confirmed라 Pixel Purchase는 허용됐지만 TikTok 유입 근거는 아님 |
| 그중 same-order `checkout_started` 있음 | 356 | 대부분 checkout은 있지만 TikTok evidence 없음 |
| 같은 `ga_session_id`에 TikTok `marketing_intent` 있음 | 1 | 단독으로는 약함. 아래 deep dive 참고 |
| 같은 `ga_session_id + client_id`에 TikTok `marketing_intent` 있음 | 1 주문 | 테스트 주문 `202605035698347`뿐 |

### 대표 샘플

| order_no | amount | Pixel final stage | checkout source | same-session marketing_intent | v2.1 rejection reason | 사람 판정 |
|---|---:|---|---|---:|---|---|
| 202605040435611 | 159000 | released_confirmed_purchase / allow_purchase | naver_cpc_organicacid1_pc | 0 | checkout exists but no TikTok evidence | 정상 차단 |
| 202605043151728 | 245000 | released_confirmed_purchase / allow_purchase | meta_biocom_yeonddle_igg | 0 | checkout exists but no TikTok evidence | 정상 차단 |
| 202605040358471 | 470220 | decision_received / allow_purchase | meta_story_kangman2_igg | 0 | checkout exists but no TikTok evidence | 정상 차단 |
| 202605036519253 | 484500 | released_confirmed_purchase / allow_purchase | direct/empty | 0 | checkout exists but no TikTok evidence | 정상 차단. 기존 canary false-positive |
| 202605031473358 | 260000 | released_unknown_purchase / hold_or_block_purchase | topbanner_MO | 1 by ga_session_id only | no order link / weak session link | strict 승격 금지 |

### Same-session 1건 deep dive

`202605031473358 / 260,000원`은 같은 `ga_session_id=1777818718`에 TikTok `marketing_intent`가 1건 있었다.

하지만 payment_success의 `client_id`는 `777879688.1777818718`이고, marketing_intent의 `client_id`는 `1351293410.1777818718`이다. 즉 `ga_session_id`만 같고 GA client id가 다르다. GA session id는 사실상 session start timestamp라 다른 사용자 사이에서 충돌할 수 있다.

따라서 이 건은 `marketing_intent unrelated`로 본다. Events API send 후보로 올리면 오귀속 위험이 더 크다.

`ga_session_id + client_id`가 둘 다 맞는 주문은 1건뿐이었고, 그 주문은 테스트 URL 카드 결제 `202605035698347`이다.

## Test / Manual Exclusion Audit

v2.1 synthetic/manual 차단 후보:

| order_no | status | amount | technical eligible | business eligible | block_reason | matched field | matched keyword | campaign | 사람 판정 |
|---|---|---:|---:|---:|---|---|---|---|---|
| 202605035698347 | confirmed | 11900 | 1 | 0 | manual_test_order | order_no | known_manual_test_order | codex_gtm_card_test | 차단 정상. TJ/Codex 테스트 주문 |
| 202605029650173 | pending | 10187 | 0 | 0 | not_confirmed, no_tiktok_evidence, synthetic_test_evidence | payment_success.utm_source | test | imwebcrm_cart+1hour_test | 차단 정상. confirmed도 아니고 TikTok evidence도 없음 |

패턴별 차단 분포:

| pattern | 차단 건수 | 해석 |
|---|---:|---|
| `codex_` | 1 | 테스트 URL 카드 결제 |
| `vm_smoke_` | 0 | 이번 7일 후보 중 production 후보 차단 없음 |
| `gtm_live_` | 0 | 이번 7일 후보 중 production 후보 차단 없음 |
| `test_` | 2 | known manual test + imwebcrm test 문자열 |
| `smoke_` | 0 | 이번 7일 후보 중 production 후보 차단 없음 |
| known manual test order | 1 | `202605035698347` |

`test` 문자열이 실제 운영 캠페인까지 과차단할 수 있는지 확인했다.

| source | campaign | count | 판정 |
|---|---|---:|---|
| checkout_started | googleads_testSA_foodallergy_SA | 3 | TikTok 후보 아님. 현재 v2.1 production 후보와 무관 |
| checkout_started | imwebcrm_cart+1hour_test | 3 | CRM 테스트성 이름. TikTok 후보 아님 |
| checkout_started | naver_blog_minzzing_iggtest3 | 2 | TikTok 후보 아님 |
| payment_success | imwebcrm_cart+1hour_test | 1 | confirmed 아님/또는 TikTok evidence 없음 |
| payment_success | naver_blog_minzzing_iggtest3 | 1 | TikTok evidence 없음 |

현재 실제 TikTok `marketing_intent` campaign 상위권에는 `test` 문자열이 없다.

| TikTok marketing_intent campaign | recent count |
|---|---:|
| tiktok_biocom_yeonddle_iggacidset | 2277 |
| tiktok_biocom_yeonddle_acid | 1337 |
| tiktok_biocom_mineralcam_mineral | 911 |
| tiktok_biocom_acidcam_acid | 195 |
| tiktok_biocom_iggcam_igg | 119 |

과차단 가능성은 낮지만 0은 아니다. 만약 실제 TikTok 캠페인명에 `test`가 들어가면 v2.1은 business 후보에서 차단할 수 있다. 다만 지금은 production send 후보가 0건이고, 실제 운영 캠페인명에는 해당 패턴이 없어 수정 긴급도는 낮다.

## GA4 Medium-Confidence Cross-Check

`2026-04-27 ~ 2026-05-04` GA4 TikTok session-source purchase를 read-only로 조회했다.

| 항목 | 값 | 해석 |
|---|---:|---|
| GA4 TikTok session-source purchase rows | 0 | 최근 7일 GA4 기준 TikTok session-source 구매 없음 |
| GA4 revenue | 0 | medium-confidence 후보 없음 |
| ledgerConfirmedRows | 0 | GA4 transaction_id로 조인할 confirmed 없음 |
| confirmedWithTikTokLedgerSignals | 0 | strict 승격 후보 없음 |

같은 기간 `/api/ads/tiktok/roas-comparison`의 operational ledger에는 TikTok 근거 confirmed 1건 / 11,900원이 보이지만, 이건 `codex_gtm_card_test` 테스트 주문 `202605035698347`이다. v2.1은 이를 `manual_test_order`로 차단한다.

따라서 GA4 cross-check에서도 production Events API 후보를 새로 만들 근거는 없다.

## 화면 / 문서 정리

최신 기준:

| 항목 | 기준 |
|---|---|
| 최신 candidate_version | `2026-05-04.shadow.rebuild.v2.1` |
| v1 후보 | 승인 근거 금지. false-positive 가능 기록으로만 보존 |
| v2 후보 | 승인 근거 금지. 테스트 주문 미차단 버전 |
| production send 후보 | 0건 |
| `/ads/tiktok` 문구 | “현재 Production 후보 0건”으로 정리 |

## 현재 Production Send Confidence

| 판단 | 추천도 | 이유 |
|---|---:|---|
| TikTok Events API production send 추가 진행 | 0% | business eligible 0건. 전송하면 오염 위험만 있음 |
| v2.1 shadow-only read-only 관찰 유지 | 94% | 실제 TikTok 주문이 생기면 후보 분포가 바뀌는지 볼 수 있음 |
| session-only 후보를 strict/send 후보로 승격 | 0% | client id/order link 없는 session id 단독 매칭은 충돌 위험 큼 |
| test 문자열 exclusion 즉시 수정 | 35% | 과차단 가능성은 있으나 현재 실제 TikTok 캠페인명에는 영향 없음 |

## 다음 대기 / 재점검 기준

| Lane | 추천도 | 담당 | 무엇을 | 왜 | 어떻게 | 승인 필요 | 성공 기준 | 실패 시 해석 |
|---|---:|---|---|---|---|---|---|---|
| Green | 94% | Codex | 24시간 뒤 v2.1 read-only 후보 재점검 | 실제 TikTok 주문이 생겼는지 확인 | 같은 dry-run을 실행해 total/business eligible/manual exclusion 분포 비교 | NO | business eligible 0 유지 또는 실제 주문 근거가 붙은 새 후보 발견 | 후보가 생기면 Yellow 검토표로 승격 |
| Green | 85% | Codex | 실제 TikTok 캠페인명에 `test/smoke/codex` 계열이 들어가는지 주기 확인 | synthetic exclusion 과차단 방지 | TikTok Ads API/marketing_intent campaign 목록 read-only 조회 | NO | 운영 캠페인명에 test 계열 없음 | 있으면 exclusion rule을 campaign allowlist 방식으로 개선 |
| Yellow | 70% | TJ + Codex | 실제 광고 클릭 후 카드 결제 1건 발생 시 후보 검토 | production send 후보가 생길 수 있는 유일한 안전 경로 | `payment_success`에 ttclid/TikTok UTM이 직접 남는지 확인하고 v2.1 후보표 생성 | 새 sprint 승인 권장 | business eligible 후보가 실제 운영 주문으로 확인 | 테스트/합성/세션충돌이면 차단 유지 |
| Red | 0% | TJ + Codex | TikTok Events API production send 추가 | 현재 후보가 없어 하지 말아야 함 | 별도 Red 승인 전 금지 | YES | 해당 없음 | 실행하면 하네스 위반 및 ROAS 오염 |

## 검증

| Check | Result | 근거 |
|---|---|---|
| 추가 TikTok Events API production send | PASS | 이번 감사에서 endpoint 호출 없음 |
| 추가 TikTok Test Events send | PASS | Test Events 호출 없음 |
| GA4/Meta/Google 전환 전송 | PASS | read-only GA4 조회만 수행 |
| GTM 변경 | PASS | 없음 |
| Purchase Guard 변경 | PASS | 없음 |
| 개발팀 관리 운영DB PostgreSQL write | PASS | 접속/write 없음 |
| VM SQLite 신규 write | PASS | dry-run/read-only 조회만 수행 |
| v2.1 stored row 상태 | PASS | `send_candidate_true=0`, `platform_status_violation=0`, `eligible_true=0` |

## Auditor Verdict

Auditor verdict: PASS

production send 보류 판단이 맞다. missed-order audit에서 실제 TikTok 주문 후보를 과도하게 놓쳤다는 강한 증거는 없다. 다만 `ga_session_id` 단독 연결은 충돌 가능성이 있으므로, 향후에도 `client_id + order link + direct TikTok evidence` 없는 후보는 production send로 올리지 않는다.
