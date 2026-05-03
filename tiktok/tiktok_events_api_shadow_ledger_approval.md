# TikTok Events API Shadow Candidate Ledger Local Implementation + VM Dry Run

작성 시각: 2026-05-03 01:07 KST
요청 유형: Yellow Lane 승인 요청 초안
대상: TJ 관리 Attribution VM `att.ainativeos.net` 내부 SQLite
데이터/DB 위치:
- 운영DB: 개발팀 관리 PostgreSQL `dashboard.public.tb_iamweb_users`, write 금지
- TJ 관리 Attribution VM: `CRM_LOCAL_DB_PATH#tiktok_events_api_shadow_candidates`, 승인 후 shadow write 대상
- 로컬 개발 DB: `/Users/vibetj/coding/seo/backend/data/crm.sqlite3`, 로컬 테스트 대상
운영DB 영향: 없음
외부 전환 전송: 없음
Codex 진행 추천 자신감: 84%

## 한 줄 결론

TikTok Events API를 실제로 보내기 전에, TJ 관리 Attribution VM에 “보낼 수 있었던 후보와 막은 이유”만 저장하는 shadow 원장을 만든다.

승인해도 TikTok으로 이벤트를 보내지 않는다.

## 무엇을 하는가

아래 작업을 한다.

1. 로컬에서 shadow candidate 생성 로직을 구현한다. 2026-05-03 완료.
2. TJ 관리 Attribution VM에 `tiktok_events_api_shadow_candidates` 테이블을 만든다.
3. 최근 7일 또는 제한된 window에서 후보를 계산한다.
4. 최대 50건만 shadow row로 저장한다.
5. 모든 row가 `send_candidate=false`와 `platform_send_status=not_sent`인지 검증한다.
6. eligible 후보와 block reason 분포를 문서화한다.

## 왜 하는가

지금 TikTok Events API production send를 바로 켜면 위험하다.

이유:
- browser Pixel은 이미 `Purchase`를 보낸다.
- 서버 event_id가 browser final event_id와 다르면 중복 전환이 생길 수 있다.
- pending 가상계좌나 TikTok 근거 없는 주문을 보내면 ROAS가 더 오염된다.

shadow 원장은 이 문제를 TikTok으로 보내기 전에 내부에서 검증하는 장치다.

## 데이터가 충분한가

부분적으로 충분하다.

충분한 데이터:
- `tiktok_pixel_events`: Guard가 본 Purchase release/block 로그
- `attribution_ledger`: `payment_success`, `marketing_intent`, firstTouch 후보
- 기존 Pixel Helper 기록: `Purchase_{order_code}` 최종 event_id 규칙

부족한 데이터:
- TikTok Events API Test Events 실제 수신 결과
- TikTok Events API token 권한 확인
- TikTok Diagnostics dedup 결과

따라서 이번 sprint는 shadow ledger까지만 승인하는 것이 맞다.

## 어떻게 하는가

실행 순서:

1. 로컬 구현
   - `backend/src/tiktokEventsApiShadowCandidates.ts`
   - `backend/scripts/tiktok-events-api-shadow-candidates.ts`
   - `backend/tests/tiktok-events-api-shadow-candidates.test.ts`
   - 상태: 2026-05-03 완료

2. 로컬 검증
   - `--dry-run`으로 후보만 출력
   - DB write 없음
   - pending/no-evidence/confirmed fixture 테스트
   - 상태: 2026-05-03 완료. 타입체크 통과, 신규 테스트 5/5 통과, local dry-run `writtenRows=0`

3. VM 배포
   - TJ 관리 Attribution VM 백업
   - 코드 반영
   - node/typecheck 가능 범위 검증
   - PM2 restart가 필요하면 수행

4. VM dry-run
   - 최근 7일 기준 후보 계산
   - `send_candidate_true=0` 확인

5. VM limited apply
   - `--apply --limit 50`
   - 최대 50건만 `CRM_LOCAL_DB_PATH#tiktok_events_api_shadow_candidates`에 저장

6. 검증
   - 모든 row `send_candidate=false`
   - 모든 row `platform_send_status=not_sent`
   - `eligible_for_future_send`와 `block_reason` 분포 확인
   - 운영DB PostgreSQL write 없음 확인

## 허용 범위

- 로컬 코드 구현. 2026-05-03 완료
- 로컬 테스트. 2026-05-03 완료
- TJ 관리 Attribution VM 코드 배포
- TJ 관리 Attribution VM SQLite table 생성
- TJ 관리 Attribution VM SQLite shadow row 최대 50건 insert/upsert
- read-only summary API 또는 CLI 출력
- 문서 업데이트
- audit
- commit/push

## 금지 범위

- TikTok Events API production send
- TikTok Events API Test Events send
- GA4/Meta/Google 전환 전송
- GTM Production publish 변경
- GTM Preview 변경
- Purchase Guard 변경
- firstTouch 후보를 strict confirmed로 승격
- `payment_success` top-level attribution 덮어쓰기
- 개발팀 관리 운영DB PostgreSQL write
- 자동 dispatcher 또는 scheduler 상시 ON

## Hard Fail

아래 중 하나라도 발생하면 즉시 중단하고 롤백한다.

- `send_candidate=true` row 생성
- `platform_send_status != not_sent`
- TikTok endpoint 호출 로그 발생
- 운영DB PostgreSQL write 발생
- pending 가상계좌가 eligible로 분류됨
- TikTok evidence 없는 confirmed order가 eligible로 분류됨
- server event_id 후보가 raw `o...`로 저장됨
- raw PII가 payload preview에 저장됨
- 50건 초과 live shadow insert

## Success Criteria

성공 기준:

- VM health 정상
- shadow table 존재
- row 수 1~50건 저장 또는 후보 없음이면 0건 사유 기록
- 모든 row `send_candidate=false`
- 모든 row `platform_send_status=not_sent`
- confirmed + TikTok evidence 주문은 `eligible_for_future_send=true` 후보로 분류
- pending/canceled/no-evidence 주문은 block reason으로 분리
- 결과 문서에 source/window/freshness/confidence 기록

## Rollback

롤백 방법:

1. 배포 전 SQLite 백업 복구
2. 또는 `DROP TABLE tiktok_events_api_shadow_candidates`
3. 또는 `DELETE FROM tiktok_events_api_shadow_candidates WHERE candidate_version='2026-05-03.shadow.v1'`
4. backend artifact를 이전 버전으로 복구
5. PM2 restart

Rollback 확인:
- `tiktok_events_api_shadow_candidates` row가 제거되거나 이전 DB 상태로 복귀
- `/ads/tiktok` 기존 strict/firstTouch/platform-only 화면 영향 없음
- TikTok Events API send 0건 유지

## 승인 문구

승인하려면 아래처럼 승인하면 된다.

```text
TikTok Events API Shadow Candidate Ledger Local Implementation + VM Dry Run sprint를 승인합니다.

허용:
- 로컬 구현/테스트
- TJ 관리 Attribution VM 배포
- VM SQLite shadow table 생성
- 최근 7일 window dry-run
- shadow row 최대 50건 insert/upsert
- 결과 문서 업데이트
- audit/commit/push

금지:
- TikTok Events API production send
- TikTok Test Events send
- GA4/Meta/Google 전환 전송
- GTM 변경
- Purchase Guard 변경
- firstTouch strict 승격
- payment_success top-level attribution 덮어쓰기
- 개발팀 관리 운영DB PostgreSQL write
- 50건 초과 insert
```

## 승인 후 다음 액션

Codex가 할 일:
- 위 범위 안에서 구현부터 VM dry-run/apply 50건까지 진행한다.
- 결과를 별도 문서로 남긴다.
- hard fail이 발생하면 중단하고 롤백한다.

TJ님이 할 일:
- 승인 문구로 Yellow Lane sprint를 승인한다.
- 직접 해야 하는 화면 작업은 없다. 이 sprint는 Codex가 VM/로컬에서 처리할 수 있다.

## Auditor verdict

Auditor verdict: NEEDS_HUMAN_APPROVAL

이 문서는 승인 요청 초안이다. 문서 작성은 Green Lane으로 완료됐지만, VM 배포와 VM SQLite write는 Yellow Lane이므로 TJ님 명시 승인 전 실행하지 않는다.

## 실행 결과

2026-05-03 TJ님이 Yellow Lane sprint를 승인했고, Codex가 TJ 관리 Attribution VM에 shadow 원장 dry-run/apply를 완료했다.

결과 문서: `tiktok/tiktok_events_api_shadow_ledger_vm_dry_run_result.md`

핵심 결과:
- VM SQLite `tiktok_events_api_shadow_candidates` row 17건 생성
- 모든 row `send_candidate=false`
- 모든 row `platform_send_status=not_sent`
- TikTok Events API production send 0건
- TikTok Test Events send 0건
- 개발팀 관리 운영DB PostgreSQL write 0건
