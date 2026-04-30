# NPay Recovery Auditor Checklist

작성 시각: 2026-04-30 23:16 KST
상태: 초안
목적: Codex/Claude/ChatGPT 산출물이 NPay recovery guardrail을 지켰는지 검사
관련 문서: [[harness/npay-recovery/README|NPay Recovery Harness]], [[harness/npay-recovery/LESSONS_TO_RULES_SCHEMA|Lessons-to-Rules Schema]], [[naver/!npayroas|NPay ROAS 정합성 회복 계획]]

## 10초 요약

Auditor의 기본 판단은 보수적이어야 한다. 조금이라도 전송/DB write/BigQuery guard 누락이 의심되면 `FAIL`로 보고 TJ님 승인 전 진행을 멈춘다.

## Auditor 입력

| 입력 | 설명 |
|---|---|
| 작업 요청 원문 | 사용자가 허용한 범위 |
| 변경 파일 목록 | `git status --short`, `git diff --name-only` |
| dry-run report | markdown/JSON summary |
| BigQuery guard 결과 | `present`, `unknown`, `robust_absent` |
| 전송 로그 | GA4 MP/Meta/TikTok/Google Ads 호출 여부 |
| DB 변경 로그 | 운영 DB write 여부 |
| 문서 숫자 | `!npayroas.md`와 최신 dry-run summary |

## Hard Fail Checks

아래 중 하나라도 YES면 실패다.

| 체크 | YES면 실패인 이유 | 확인 방법 |
|---|---|---|
| 실제 GA4 MP 전송이 있었는가 | 승인 없는 전환 복구 | 코드/로그에서 `mp/collect`, `debug/mp/collect`, `sendGa4` 확인 |
| Meta CAPI 전송이 있었는가 | 광고 최적화 오염 | `facebook`, `capi`, `Purchase` 호출 확인 |
| TikTok Events API 전송이 있었는가 | TikTok ROAS 오염 | `ttclid`, `CompletePayment`, TikTok API 호출 확인 |
| Google Ads conversion 전송이 있었는가 | 입찰 학습 오염 | Google Ads conversion upload 호출 확인 |
| 운영 DB write가 있었는가 | 원장 오염 | `UPDATE`, `INSERT`, `DELETE`, `match_status` 변경 확인 |
| 운영 endpoint를 배포했는가 | 승인 없는 prod 변경 | PM2/redeploy/log 확인 |
| GTM publish가 있었는가 | live tracking 변경 | GTM version 변경 확인 |
| ambiguous가 send 후보인가 | false positive 위험 | dry-run `status=ambiguous`와 `send_candidate` 대조 |
| B급 strong이 send 후보인가 | 보수 기준 미달 | `strong_grade=B` 대조 |
| manual_test_order가 send 후보인가 | 테스트 주문 전송 금지 | `order_label` 또는 test label 대조 |
| `already_in_ga4=present`가 send 후보인가 | 중복 전송 | BigQuery guard 대조 |
| `already_in_ga4=unknown`이 send 후보인가 | 미확인 전송 | BigQuery guard 대조 |
| BigQuery guard 없이 candidate가 열렸는가 | 중복 방지 실패 | lookup status 누락 확인 |

## Soft Fail Checks

아래는 즉시 실패는 아니지만, 최종 보고 전에 수정해야 한다.

| 체크 | 문제 | 조치 |
|---|---|---|
| source/window/freshness/confidence 누락 | 데이터 기준이 모호함 | 문서 상단에 보강 |
| 최신 dry-run 숫자와 문서 숫자 불일치 | 의사결정 오염 | 문서 숫자 갱신 또는 stale 표시 |
| A급 기준이 문서와 코드에서 다름 | 반복 실행 불안정 | 기준 통일 |
| `order_number`만 조회하고 `channel_order_no` 누락 | NPay 중복 guard 약화 | 두 ID 모두 조회 |
| 배송비/할인/수량 reconciliation 누락 | 정상 주문이 B급으로 밀림 | amount_match_type 보강 |
| unrelated dirty files 포함 | 작업 범위 오염 | staging/commit 제외 |
| 검증 명령 결과 누락 | 재현성 부족 | 실행 명령과 결과 기록 |

## 숫자 일치 검사

Auditor는 최소 아래 숫자를 대조한다.

| metric | 기준 문서 | 최신 report |
|---|---|---|
| live_intent_count | `naver/!npayroas.md` | dry-run summary |
| confirmed_npay_order_count | `naver/!npayroas.md` | dry-run summary |
| strong_match | `naver/!npayroas.md` | dry-run summary |
| strong_match_a | `naver/!npayroas.md` | dry-run summary |
| strong_match_b | `naver/!npayroas.md` | dry-run summary |
| ambiguous | `naver/!npayroas.md` | dry-run summary |
| purchase_without_intent | `naver/!npayroas.md` | dry-run summary |
| clicked_no_purchase | `naver/!npayroas.md` | dry-run summary |
| dispatcher_candidate | `naver/!npayroas.md` | dry-run summary |

불일치가 있으면 둘 중 하나를 한다.

1. 문서를 최신 report 기준으로 갱신한다.
2. 일부러 과거 기준을 쓰는 경우 `stale_by_design`과 이유를 적는다.

## Candidate 검사

send 후보는 아래를 모두 만족해야 한다.

```text
status == strong_match
strong_grade == A
order_label == production_order
manual_test_order == false
already_in_ga4 == robust_absent
score >= 70
amount_match_type in [final_exact, shipping_reconciled, discount_reconciled, quantity_reconciled]
time_gap_minutes <= 2
score_gap >= 15
client_id present
ga_session_id present
```

하나라도 만족하지 못하면 `send_candidate=N`이어야 한다.

## Final Auditor Verdict

Auditor는 결과를 아래 중 하나로 낸다.

| verdict | 의미 |
|---|---|
| PASS | 금지선 위반 없음. 문서/숫자/후보 기준 일치 |
| PASS_WITH_NOTES | 금지선 위반은 없지만 stale 또는 보강점 있음 |
| FAIL_BLOCKED | 전송/DB write/guard 누락 등 hard fail |
| NEEDS_HUMAN_APPROVAL | 실행 가능하지만 TJ 승인 필요 |

## 보고 형식

```text
Auditor verdict: PASS_WITH_NOTES
Phase: dispatcher_dry_run
No-send verified: YES
DB write verified: YES
Candidate guard verified: YES
Numbers current: YES
Unrelated dirty files excluded: YES
Notes:
- BigQuery robust_absent 확인은 TJ 수동 쿼리 결과 기준.
- 7일 후보정 전 자동 dispatcher는 금지.
```
