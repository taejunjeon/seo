# codexfeedback_0329_4 reply

기준일: 2026-03-29

## 1. 이번 턴 목적

이번 턴의 목적은 범위를 넓히지 않고 아래 3가지만 닫는 것이었다.

- `P1-S1A` live 연결 전에도 바로 검증할 수 있는 보조 도구 만들기
- `P1-S1` shadow run을 더 빠르고 덜 헷갈리게 다시 돌리기
- `P3-S1`의 `memberId = customer_key` 계약을 문서와 응답 shape로 고정하기

결론은 이렇다.

- `P1-S1A`는 receiver 연결 즉시 검증할 도구까지 준비됐다.
- `P1-S1`은 local shadow 기준으로 반복 실행성이 좋아졌고, message log 최소 포맷도 실제 import까지 닫혔다.
- `P3-S1`은 `memberId = customer_key` 규칙이 사람용 문서와 API 응답 둘 다에서 같은 내용으로 고정됐다.

## 2. 실제로 한 일

### P1-S1A

- `GET /api/attribution/hourly-compare`를 추가했다.
- `toss-join` summary에 `matchedByPaymentKey`, `matchedByOrderId`, `paymentSuccessEntriesWithPaymentKey`, `paymentSuccessEntriesWithOrderId`, `ledgerCoverageRate`를 넣었다.
- `backend/scripts/attribution-smoke-check.ts`를 추가했다.
- receiver payload, curl, smoke 절차, 운영 체크리스트를 문서로 만들었다.

### P1-S1

- shadow runner에 `date pushdown`, `scan_limit`, `full scan fallback`을 넣었다.
- shadow runner 결과에 `seed_fetch`, `preview_sample`, `timings`를 남기게 했다.
- `message_log_file` 옵션을 추가해서 수동 message import가 가능하게 했다.
- wrapper에 `SEED_START_DATE`, `SCAN_LIMIT`, `MESSAGE_LOG_FILE`, `PRINT_DB_CHECKLIST`를 붙였다.
- local-only shadow run을 두 번 다시 돌렸다.

### P3-S1

- Revenue API 쪽에 `/api/crm/channeltalk/contract`를 추가했다.
- contract 응답에 아래를 고정했다.
  - `identity_principle`
  - `member_id_rule`
  - `identity_field_table`
  - `page_name_rules`
  - `event_naming_rules`
  - `campaign_minimal_response_shape`
  - `stale_check_query_draft`
- 위 내용을 실무 문서로도 따로 정리했다.

## 3. 왜 이게 지금 필요한지

이 세 작업은 모두 `운영 반영 전에 우리가 직접 닫을 수 있는 준비 작업`이다.

- `P1-S1A`는 live row가 아직 0건이라, 연결되는 순간 바로 확인할 도구가 필요했다.
- `P1-S1`은 돌아가긴 했지만 반복 실행이 무겁고 message log가 비어 있어, 실험 그림을 설명하기 어려웠다.
- `P3-S1`은 기준 키 규칙이 흐리면 상담, 메시지, 매출 연결이 전부 흔들린다.

즉 이번 턴은 새 Phase 확장이 아니라, `기존 Phase를 운영 handoff 직전 수준으로 정리하는 턴`이었다.

## 4. 산출물 목록

### 코드

- `/Users/vibetj/coding/seo/backend/src/attribution.ts`
- `/Users/vibetj/coding/seo/backend/src/routes/attribution.ts`
- `/Users/vibetj/coding/seo/backend/tests/attribution.test.ts`
- `/Users/vibetj/coding/seo/backend/scripts/attribution-smoke-check.ts`
- `/Users/vibetj/coding/revenue/backend/scripts/run_crm_phase1_shadow.py`
- `/Users/vibetj/coding/seo/codex/run_p1s1_shadow_local.sh`
- `/Users/vibetj/coding/revenue/backend/app/services/channeltalk_service.py`
- `/Users/vibetj/coding/revenue/backend/app/api/crm.py`
- `/Users/vibetj/coding/revenue/backend/test_channeltalk_contract.py`

### 문서

- `/Users/vibetj/coding/seo/codex/p1s1a_receiver_playbook_20260329.md`
- `/Users/vibetj/coding/seo/codex/p1s1_shadow_local_20260329_v2.md`
- `/Users/vibetj/coding/seo/codex/p1s1_message_log_minimal.sample.json`
- `/Users/vibetj/coding/seo/codex/p3s1_channeltalk_contract_20260329.md`

### 범위 관리 메모

- 이번 턴은 피드백 원칙에 맞춰 `roadmap0327.md`, `Phase1.md`는 건드리지 않았다.

## 5. 검증 결과

### P1-S1A

- `npm --prefix /Users/vibetj/coding/seo/backend run typecheck` 통과
- `cd /Users/vibetj/coding/seo/backend && node --import tsx --test tests/attribution.test.ts` 결과 `5 passed`
- `cd /Users/vibetj/coding/seo/backend && npx tsx scripts/attribution-smoke-check.ts` 실제 실행
  - receiver delta `2`
  - ledger total `2`
  - hourly compare 응답 확인
  - toss join summary 응답 확인

### P1-S1

- `python3 -m py_compile ...` 통과
- local-only dry-run 재실행
  - seed fetch `0.035초`
  - total `0.119초`
- local-only + message import 재실행
  - seed fetch `0.028초`
  - total `0.095초`
  - message import `1건`
- read-only source 재측정 시도
  - 이번 턴에는 `asyncpg connection reset by peer`로 실패

### P3-S1

- `cd /Users/vibetj/coding/revenue/backend && pytest -q test_channeltalk_contract.py` 결과 `2 passed`

## 6. 아직 안 닫힌 리스크 3개

1. `P1-S1A`는 아직 실제 고객 사이트 호출이 없어 live receiver row 검증이 smoke 수준에 머문다.
2. `P1-S1` read-only source benchmark는 이번 턴에 source DB connection reset으로 다시 못 닫았다.
3. `P3-S1` contract는 고정됐지만, 실제 boot/updateUser/track가 고객 사이트에 삽입된 것은 아직 아니다.

## 7. 다음 턴 추천 1개

다음 턴은 `P1-S1A live 연결 1건`을 먼저 닫는 것이 맞다.

이유는 단순하다.

- receiver가 실제로 붙으면 `(not set)` 검증이 비로소 데이터 단계로 넘어간다.
- `hourly compare`, `toss join`, `smoke script`를 만든 효과도 그때 바로 나온다.
- 지금 가장 큰 불확실성은 코드 부족이 아니라 live 신호 부재다.
