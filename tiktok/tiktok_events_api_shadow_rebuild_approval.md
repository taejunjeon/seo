# TikTok Events API Shadow Candidate Rebuild Approval

작성 시각: 2026-05-04 13:37 KST
요청 유형: Yellow Lane 승인 요청
대상: TJ 관리 Attribution VM SQLite `CRM_LOCAL_DB_PATH#tiktok_events_api_shadow_candidates`
운영DB 영향: 없음. 개발팀 관리 PostgreSQL `dashboard.public.tb_iamweb_users` write 금지
외부 전환 전송: 없음. TikTok Events API send 금지
Codex 진행 추천 자신감: 95%
다른 에이전트 검증: 선택. production send는 없지만 기존 후보 원장을 갈아엎는 작업이라 리뷰하면 더 안전하다

```yaml
harness_preflight:
  common_harness_read: "AGENTS.md, harness/common/HARNESS_GUIDELINES.md, harness/common/AUTONOMY_POLICY.md, harness/common/REPORTING_TEMPLATE.md"
  project_harness_read: "harness/tiktok/LESSONS.md"
  required_context_docs:
    - "docurule.md"
    - "tiktok/tiktok_events_api_production_canary_result_20260504.md"
    - "tiktok/tiktok_events_api_shadow_candidate_review_20260503.md"
    - "tiktok/tiktok_events_api_shadow_ledger_design.md"
  lane: "Yellow"
  allowed_actions:
    - "TJ 관리 Attribution VM 배포/파일 반영"
    - "패치된 후보 생성 로직으로 VM dry-run"
    - "기존 candidate_version=2026-05-03.shadow.v1 row 백업"
    - "새 candidate_version row 최대 50건 shadow-only upsert"
    - "human-readable candidate review 재작성"
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
    - "scheduler/dispatcher 상시 ON"
  source_window_freshness_confidence:
    source: "TJ 관리 Attribution VM SQLite tiktok_pixel_events + attribution_ledger"
    window: "최근 7일, biocom"
    freshness: "승인 후 실행 시각 기준"
    site: "biocom"
    confidence: 0.95
```

## 한 줄 결론

기존 Events API shadow 후보 17건은 더 이상 안전한 승인 근거가 아니다.

이 문서는 패치된 후보 생성 로직으로 TJ 관리 Attribution VM의 shadow 후보 원장을 다시 계산하고, 사람이 읽는 후보 검토표를 다시 만들기 위한 승인 문서다. TikTok으로 이벤트를 보내지 않는다.

## 무엇을 하는가

1. 로컬에서 수정한 `backend/src/tiktokEventsApiShadowCandidates.ts`와 테스트를 VM에 반영한다.
2. VM에서 최근 7일 window로 dry-run을 먼저 실행한다.
3. 기존 `candidate_version='2026-05-03.shadow.v1'` row를 백업한다.
4. 새 candidate_version으로 최대 50건만 shadow-only upsert한다.
5. 모든 row는 `send_candidate=false`, `platform_send_status=not_sent`를 유지한다.
6. 새 후보표를 A/B/C로 다시 분류한다.

## 왜 하는가

production canary 사후 감사에서 기존 후보 생성 로직의 false-positive가 확인됐다.

구체적으로는 주문 `202605036519253`이 기존 리뷰에서는 `ttclid=Y` 후보였지만, 주문별 원장 재검산에서는 `ttclid=false`, TikTok UTM 없음, TikTok referrer 없음, `firstTouch.tiktokMatchReasons=[]`였다.

이 상태에서 추가 Test Events나 production send를 진행하면 TikTok 유입이 아닌 주문을 서버 이벤트로 보낼 수 있다.

## 어떻게 하는가

승인 후 Codex 실행 순서:

1. VM SSH 또는 배포 경로를 확인한다.
2. 현재 VM 파일과 SQLite를 백업한다.
3. 패치 파일을 반영한다.
4. `node --test` 또는 `npx tsx --test tests/tiktok-events-api-shadow-candidates.test.ts`로 후보 로직 테스트를 실행한다.
5. `--apply` 없이 dry-run으로 새 후보 분포를 확인한다.
6. dry-run에서 `no_tiktok_evidence` 차단이 정상적으로 늘어나는지 본다.
7. 기존 row를 백업한다.
8. 새 `candidate_version`으로 최대 50건 upsert한다.
9. `send_candidate=true` 또는 `platform_send_status != not_sent`가 0건인지 확인한다.
10. 새 후보 검토 문서를 작성한다.

## 허용 범위

- TJ 관리 Attribution VM 파일 반영
- VM SQLite shadow 후보 테이블 write
- 최대 50건 upsert
- 새 candidate_version 사용
- read-only API/SQLite 검증
- 문서 업데이트
- audit/commit/push

## 금지 범위

- TikTok Events API production send
- TikTok Test Events send
- GA4/Meta/Google send
- GTM 변경
- Purchase Guard 변경
- 개발팀 관리 운영DB PostgreSQL write
- 기존 payment_success attribution 수정
- firstTouch 후보를 strict confirmed로 승격
- scheduler/dispatcher ON

## Hard Fail

아래 중 하나라도 발생하면 중단한다.

1. dry-run 없이 apply가 필요해진다.
2. 50건 초과 write가 필요해진다.
3. `send_candidate=true` row가 생긴다.
4. `platform_send_status`가 `not_sent` 외 값으로 바뀐다.
5. raw/hash PII가 payload preview에 들어간다.
6. 운영DB write가 필요해진다.
7. TikTok endpoint 호출이 필요해진다.
8. VM SSH/배포 경로가 불명확하다.

## Success Criteria

- 패치된 테스트 통과
- dry-run summary 기록
- 새 shadow row는 모두 `send_candidate=false`
- 새 shadow row는 모두 `platform_send_status=not_sent`
- `no_tiktok_evidence` 후보가 정상 차단됨
- 새 후보 검토표 생성
- no-send/no-platform-send 확인
- 운영DB write 0건

## Rollback

문제 발생 시:

1. 새 candidate_version row를 삭제한다.
2. 백업한 기존 row를 복원하거나 기존 `2026-05-03.shadow.v1` row를 그대로 둔다.
3. 배포 파일을 이전 버전으로 되돌린다.
4. 결과 문서에 `FAIL_BLOCKED`를 기록한다.

## 승인 문구

```text
TikTok Events API Shadow Candidate Rebuild sprint를 승인합니다.

허용:
- TJ 관리 Attribution VM에 패치된 shadow 후보 생성 로직 반영
- VM dry-run
- 기존 shadow row 백업
- 새 candidate_version으로 최대 50건 shadow-only upsert
- 새 후보 검토표 작성
- audit/commit/push

금지:
- TikTok Events API production send
- TikTok Test Events send
- GA4/Meta/Google 전환 전송
- GTM 변경
- Purchase Guard 변경
- 개발팀 관리 운영DB PostgreSQL write
- firstTouch strict 승격
- payment_success top-level attribution overwrite
- scheduler/dispatcher ON

조건:
- 모든 row는 send_candidate=false
- 모든 row는 platform_send_status=not_sent
- raw/hash PII 저장 금지
- dry-run 결과 확인 후 apply
```

## Auditor verdict

Auditor verdict: NEEDS_HUMAN_APPROVAL

문서 작성은 Green Lane으로 완료한다. VM 반영과 shadow row 재생성은 Yellow Lane이라 TJ님 승인 전 실행하지 않는다.
