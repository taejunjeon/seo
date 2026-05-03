# TikTok Events API Test Events Only Smoke Result

작성 시각: 2026-05-03 19:59 KST
Project: TikTok ROAS 정합성 개선
Sprint: TikTok Events API Test Events Only Smoke
Lane: Yellow
Mode: Test Events only readiness + hard-fail stop
Auditor verdict: FAIL_BLOCKED
현재 판정: Test Event Code 부재로 endpoint 호출 전 중단. TikTok Test Events send 0건
진행 추천 점수: 42%

```yaml
harness_preflight:
  common_harness_read: "harness/common/HARNESS_GUIDELINES.md, harness/common/AUTONOMY_POLICY.md, harness/common/REPORTING_TEMPLATE.md"
  project_harness_read: "harness/tiktok/LESSONS.md"
  required_context_docs:
    - "AGENTS.md"
    - "tiktok/tiktok_events_api_test_events_approval.md"
    - "tiktok/tiktok_events_api_shadow_candidate_review_20260503.md"
    - "tiktok/tiktok_events_api_shadow_ledger_vm_dry_run_result.md"
  lane: "Yellow"
  allowed_actions:
    - "TikTok Events Manager Test Event Code 확인"
    - "Events API token 권한 확인"
    - "A등급 후보 1건만 Test Events endpoint 전송"
    - "VM shadow row read-only 검증"
    - "결과 문서 업데이트"
    - "audit"
    - "commit/push"
  forbidden_actions:
    - "TikTok Events API production send"
    - "2건 이상 전송"
    - "Purchase reject 후 CompletePayment 자동 재전송"
    - "GA4/Meta/Google 전환 전송"
    - "GTM 변경"
    - "Purchase Guard 변경"
    - "firstTouch strict 승격"
    - "payment_success top-level attribution overwrite"
    - "개발팀 관리 운영DB PostgreSQL write"
    - "scheduler/dispatcher 상시 ON"
    - "VM shadow row send_candidate=true 변경"
    - "VM shadow row platform_send_status 변경"
  source_window_freshness_confidence:
    source: "TJ 관리 Attribution VM SQLite tiktok_events_api_shadow_candidates + backend/.env readiness"
    window: "candidate_version=2026-05-03.shadow.v1, order_no=202605036519253"
    freshness: "2026-05-03 19:59 KST"
    site: "biocom"
    confidence: 0.76
```

## 한 줄 결론

Test Events endpoint를 호출하지 않았다.

이유는 Test Event Code가 로컬 `backend/.env`와 TJ 관리 Attribution VM `backend/.env` 어디에도 없었기 때문이다. 승인 문서의 Hard Fail 조건이 “Test Event Code 없이 send 필요”였으므로, 전송 전 즉시 중단하는 것이 맞다.

## 완료한 것

| 항목 | 결과 | 근거 | 데이터/DB 위치 |
|---|---|---|---|
| 공식 문서 재확인 | 완료 | TikTok Events API, dedup, Test Event Function 문서 확인 | 외부 공식 문서 |
| 로컬 env readiness 확인 | 완료 | `TIKTOK_BUSINESS_ACCESS_TOKEN`은 있음. Test Event Code 변수는 없음. 값은 출력하지 않음 | 로컬 `backend/.env` |
| VM env readiness 확인 | 완료 | TikTok Events API token/code 없음. 값은 출력하지 않음 | TJ 관리 Attribution VM `backend/.env` |
| 후보 row read-only 확인 | 완료 | 후보 `202605036519253`은 A등급 조건 충족 | TJ 관리 Attribution VM SQLite |
| VM row 불변 감사 | 완료 | `sendCandidateTrue=0`, `platformSent=0`, `piiRows=0` | TJ 관리 Attribution VM SQLite |
| Test Events endpoint 호출 | 0건 | Test Event Code 부재로 Hard Fail stop | TikTok 외부 API |

## 프롬프트에 있거나 시도했으나 완료하지 못한 것

| 항목 | 상태 | 못 끝낸 이유 | 다음 판단 |
|---|---|---|---|
| Test Events endpoint 1건 전송 | 미완료 | Test Event Code 부재. Test Event Code 없이 보내면 production event 위험 | TJ님이 Test Event Code를 안전하게 제공한 뒤 재개 |
| Events API token 권한 확인 | 부분 완료 | 로컬 Business token 존재는 확인. Events API send 권한은 endpoint 호출 전이라 미확정 | Test Event Code 확보 후 1건 test call로만 확인 |
| Test Events 화면 확인 | 미완료 | endpoint 호출 0건이므로 화면 확인 대상 없음 | test call 후 TJ님이 TikTok UI에서 확인 |

## 후보 row 사전 검증

대상 후보:

| 항목 | 값 |
|---|---|
| order_no | `202605036519253` |
| order_code | `o202605033af504ba376d9` |
| amount | 484,500 KRW |
| payment_status | confirmed |
| event_name | Purchase |
| event_id_candidate | `Purchase_o202605033af504ba376d9` |
| browser_event_id_observed | `Purchase_o202605033af504ba376d9` |
| dedup_ready | true |
| TikTok evidence | `ttclid,utm_source_tiktok,referrer_tiktok,metadata_tiktok_match_reasons` |
| pixel action | `released_confirmed_purchase` |
| payment touchpoint | `payment_success` |
| send_candidate | false |
| platform_send_status | not_sent |
| raw PII | 없음 |

판정:
- 후보 자체는 Test Events only 대상으로 적합하다.
- 실패 원인은 후보 row가 아니라 Test Event Code 부재다.

## Hard Fail 발생 지점

Hard Fail:

```text
Test Event Code 없이 send 필요
```

근거:
- 로컬 `backend/.env`: TikTok Business token은 있으나 Test Event Code 계열 변수 없음
- TJ 관리 Attribution VM `backend/.env`: TikTok Events API token/code 없음
- TikTok 공식 Tealium Events API 가이드는 Test Events를 production data에 포함하지 않으려면 TTEM에서 `test_event_code`를 가져와 parameter로 매핑하라고 안내한다.

따라서 Test Event Code 없이 호출하지 않았다.

## No-Send / No-Write 감사

| 항목 | 결과 |
|---|---|
| TikTok Events API production send | 0건 |
| TikTok Test Events send | 0건 |
| GA4/Meta/Google send | 0건 |
| GTM change | 없음 |
| Purchase Guard change | 없음 |
| firstTouch strict 승격 | 없음 |
| payment_success top-level overwrite | 없음 |
| 개발팀 관리 운영DB PostgreSQL write | 없음 |
| scheduler/dispatcher 상시 ON | 없음 |
| VM shadow row `send_candidate=true` 변경 | 없음 |
| VM shadow row `platform_send_status` 변경 | 없음 |

VM SQLite 감사:

```json
{
  "version": "2026-05-03.shadow.v1",
  "summary": {
    "versionRows": 17,
    "sendCandidateTrue": 0,
    "platformSent": 0,
    "piiRows": 0
  },
  "candidate": {
    "send_candidate": 0,
    "platform_send_status": "not_sent",
    "pii_in_payload": 0
  }
}
```

## 검증 결과

| 검증 | 결과 | 해석 |
|---|---|---|
| wiki link validation | PASS | 결과 문서와 approval 문서 모두 Obsidian 링크 오류 없음 |
| `git diff --check` | PASS | 공백/패치 형식 문제 없음 |
| VM SQLite read-only audit | PASS | row 17건 유지, send/platform status 변경 없음 |
| `harness-preflight-check.py --strict` | PASS_WITH_NOTES | unrelated dirty/pre-existing 문서들에서 common harness link warning 발생. 이번 sprint 파일의 no-send/no-write 결과와 직접 충돌 없음 |

preflight warning 메모:
- `agent/!function.md`, `agent/!menu.md`, 일부 기존 tiktok/data/harness 문서가 global fork 의심 warning을 냈다.
- 이번 sprint에서 해당 파일들은 수정하지 않는다.
- 이번 변경 파일은 `tiktok/tiktok_events_api_test_events_smoke_result_20260503.md`, `tiktok/tiktok_events_api_test_events_approval.md`로 제한한다.

## 공식 문서 근거

TikTok 공식 문서 기준:

- Events API는 웹 연결에서 기존 Pixel과 함께 쓸 수 있고, TikTok은 Pixel + Events API + dedup 구성을 권장한다. 참고: https://ads.tiktok.com/help/article/events-api
- dedup은 Pixel과 Events API가 같은 conversion을 보낼 때 event_id를 공유해야 하며, 동일 event와 event_id는 48시간 window 기준으로 처리된다. 참고: https://ads.tiktok.com/help/article/event-deduplication
- Test Events는 TTEM의 Test Events 탭에서 `test_event_code`를 가져와 parameter로 매핑하는 방식으로 production data 포함을 피한다. 참고: https://ads.tiktok.com/help/article/tiktok-tealium-eapi-implementation-guide

## 다음 액션

### 1. TJ님이 할 일

추천 점수: 82%

무엇을 하는가:
- TikTok Events Manager에서 `biocom_tiktok_web_pixel` / pixel code `D5G8FTBC77UAODHQ0KOG`의 Test Event Code를 확인한다.

왜 하는가:
- Test Event Code 없이는 test event가 production event로 처리될 위험이 있어 Codex가 전송하면 안 된다.

어떻게 하는가:
1. TikTok Ads Manager 또는 Events Manager 접속
2. Data Sources 또는 Event Sources에서 `biocom_tiktok_web_pixel` 선택
3. Pixel code가 `D5G8FTBC77UAODHQ0KOG`인지 확인
4. Test Events 탭으로 이동
5. Test Event Code를 확인
6. 대화에 평문으로 붙이지 말고, 가능하면 로컬 `backend/.env`에 `TIKTOK_EVENTS_TEST_EVENT_CODE=<code>`처럼 임시로 넣은 뒤 “넣었다”고만 알려준다.

성공 기준:
- Codex가 값 자체를 출력하지 않고 존재 여부만 확인할 수 있다.

실패 시 확인점:
- Test Events 탭이 없거나 code가 안 보이면 해당 Pixel의 Events API 설정 권한이 아직 없을 수 있다.

### 2. Codex가 할 일

추천 점수: 78%

무엇을 하는가:
- Test Event Code가 준비되면 같은 후보 1건으로 Test Events endpoint를 1회 이하 호출한다.

왜 하는가:
- `Purchase`와 `event_id=Purchase_o202605033af504ba376d9`가 TikTok Test Events 화면에 보이는지 확인하기 위해서다.

어떻게 하는가:
1. env에 Test Event Code 존재 여부만 확인한다.
2. token과 code를 로그에 출력하지 않는다.
3. event name은 `Purchase`만 사용한다.
4. reject되더라도 `CompletePayment`로 자동 재전송하지 않는다.
5. VM shadow row가 계속 `send_candidate=false`, `platform_send_status=not_sent`인지 read-only로 확인한다.

성공 기준:
- endpoint 호출 1건 이하
- Test Events 화면에 `Purchase` 1건과 `event_id=Purchase_o202605033af504ba376d9` 표시
- production event로 보이는 징후 없음

실패 시 확인점:
- event name `Purchase` 지원 여부
- token의 Events API 권한
- Test Event Code 적용 방식
- Pixel code 일치 여부

## Auditor verdict

Auditor verdict: FAIL_BLOCKED

실패가 아니라 안전 중단이다. 승인된 sprint의 Hard Fail 조건이 정확히 작동했다.

Test Event Code가 준비되면 같은 승인 범위 안에서 재개할 수 있다. 단, 그 전에는 TikTok endpoint를 호출하지 않는다.
