# TikTok Events API Test Events Only Smoke Result

작성 시각: 2026-05-03 19:59 KST
최신 업데이트: 2026-05-04 11:42 KST
Project: TikTok ROAS 정합성 개선
Sprint: TikTok Events API Test Events Only Smoke
Lane: Yellow
Mode: Test Events only single-call smoke
Auditor verdict: PASS_WITH_NOTES
현재 판정: TikTok Test Events endpoint 1건 호출 성공. `HTTP 200`, `code=0`, `message=OK`. Production send 0건
진행 추천 점수: 86%

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
    source: "TJ 관리 Attribution VM SQLite tiktok_events_api_shadow_candidates + 로컬 backend/.env readiness + TikTok Events API Test Events response"
    window: "candidate_version=2026-05-03.shadow.v1, order_no=202605036519253"
    freshness: "2026-05-04 11:42 KST"
    site: "biocom"
    confidence: 0.86
```

## 한 줄 결론

2026-05-04 11:42 KST 기준으로 Test Events endpoint를 1건 호출했고 TikTok API 응답은 성공이다.

전송 대상은 A등급 후보 `202605036519253` / `Purchase_o202605033af504ba376d9` 1건이다. 로컬 `backend/.env`에 pixel id, access token, test code가 준비된 뒤 실행했으며, token/test code 값은 출력하지 않았다.

주의할 점:
- 이것은 **Test Events only** 호출이다.
- TikTok Events API production send는 여전히 Red Lane 금지다.
- Test Events 화면에 `Purchase`와 `event_id=Purchase_o202605033af504ba376d9`가 보이는지는 TJ님 UI 확인이 필요하다.

## 2026-05-04 재개 실행 결과

| 항목 | 결과 | 근거 | 데이터/DB 위치 |
|---|---|---|---|
| 로컬 env readiness | PASS | `TIKTOK_PIXEL_ID_BIOCOM`, `TIKTOK_ACCESS_TOKEN_BIOCOM`, `TIKTOK_TEST_CODE` 모두 존재. 값은 미출력 | 로컬 `backend/.env` |
| 후보 row 사전 검증 | PASS | confirmed, `allow_purchase`, `eligible_for_future_send=1`, `dedup_ready=1` | TJ 관리 Attribution VM SQLite `tiktok_events_api_shadow_candidates` |
| TikTok Test Events endpoint 호출 | PASS | `POST https://business-api.tiktok.com/open_api/v1.3/event/track/`, 호출 1건, `HTTP 200`, `code=0`, `message=OK`, `request_id=20260504024205A4B1A91F85C7E4D1106A` | TikTok 외부 API |
| 전송 event | PASS | `event=Purchase`, `event_id=Purchase_o202605033af504ba376d9`, `event_source=web`, `event_source_id=D5G8...0KOG`, `test_event_code` 포함 | TikTok 외부 API |
| VM row 사후 감사 | PASS | 후보 row는 계속 `send_candidate=0`, `platform_send_status=not_sent`, `pii_in_payload=0` | TJ 관리 Attribution VM SQLite |
| 전체 shadow 원장 사후 감사 | PASS | `versionRows=17`, `sendCandidateTrue=0`, `platformSent=0`, `piiRows=0` | TJ 관리 Attribution VM SQLite |

실행한 payload의 핵심 구조:

```json
{
  "event_source": "web",
  "event_source_id": "D5G8...0KOG",
  "test_event_code": "set len=9",
  "data": [
    {
      "event": "Purchase",
      "event_time": 1777862525,
      "event_id": "Purchase_o202605033af504ba376d9",
      "page": {
        "url": "https://biocom.kr/shop_payment_complete?order_code=o202605033af504ba376d9&order_no=202605036519253"
      },
      "properties": {
        "currency": "KRW",
        "value": 484500,
        "content_type": "product",
        "order_id": "202605036519253",
        "status": "confirmed"
      }
    }
  ]
}
```

secret 처리:
- access token은 출력하지 않았다.
- Test Event Code 값은 출력하지 않았다.
- 문서에는 길이만 기록했다.
- raw email/phone/name/address는 payload에 넣지 않았다.

## 2026-05-03 안전 중단 이력

2026-05-03에는 Test Event Code가 로컬 `backend/.env`와 TJ 관리 Attribution VM `backend/.env` 어디에도 없어 endpoint 호출 전 중단했다. 승인 문서의 Hard Fail 조건이 “Test Event Code 없이 send 필요”였으므로, 이 중단은 정상적인 안전 중단이었다.

## 완료한 것

| 항목 | 결과 | 근거 | 데이터/DB 위치 |
|---|---|---|---|
| 공식 문서 재확인 | 완료 | TikTok Events API, dedup, Test Event Function 문서 확인 | 외부 공식 문서 |
| 로컬 env readiness 확인 | 완료 | `TIKTOK_PIXEL_ID_BIOCOM`, `TIKTOK_ACCESS_TOKEN_BIOCOM`, `TIKTOK_TEST_CODE` 존재. 값은 출력하지 않음 | 로컬 `backend/.env` |
| VM env readiness 확인 | 보류 | 이번 재개 실행은 로컬 env로 test-only 호출. VM env에는 secret을 추가하지 않음 | TJ 관리 Attribution VM `backend/.env` |
| 후보 row read-only 확인 | 완료 | 후보 `202605036519253`은 A등급 조건 충족 | TJ 관리 Attribution VM SQLite |
| VM row 불변 감사 | 완료 | `sendCandidateTrue=0`, `platformSent=0`, `piiRows=0` | TJ 관리 Attribution VM SQLite |
| Test Events endpoint 호출 | 1건 완료 | `HTTP 200`, `code=0`, `message=OK` | TikTok 외부 API |

## 프롬프트에 있거나 시도했으나 완료하지 못한 것

| 항목 | 상태 | 못 끝낸 이유 | 다음 판단 |
|---|---|---|---|
| Test Events endpoint 1건 전송 | 완료 | 해당 없음 | 다음 단계는 UI 수신 확인 |
| Events API token 권한 확인 | 완료 | Test Events endpoint가 `code=0`으로 성공 | production send 권한/정책은 별도 Red Lane에서만 판단 |
| Test Events 화면 확인 | 미완료 | Codex는 TJ님 로그인 TikTok Events Manager UI를 직접 볼 수 없음 | TJ님이 Test Events 탭에서 `Purchase`와 event_id 표시 확인 필요 |

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
- 후보 자체는 Test Events only 대상으로 적합했다.
- 2026-05-04 재개 실행에서 TikTok API 수신은 성공했다.
- 남은 확인은 TikTok Events Manager UI에 `Purchase`와 `event_id=Purchase_o202605033af504ba376d9`가 표시되는지다.

## 2026-05-03 Hard Fail 발생 지점

Hard Fail:

```text
Test Event Code 없이 send 필요
```

근거:
- 로컬 `backend/.env`: TikTok Business token은 있으나 Test Event Code 계열 변수 없음
- TJ 관리 Attribution VM `backend/.env`: TikTok Events API token/code 없음
- TikTok 공식 Tealium Events API 가이드는 Test Events를 production data에 포함하지 않으려면 TTEM에서 `test_event_code`를 가져와 parameter로 매핑하라고 안내한다.

따라서 2026-05-03에는 Test Event Code 없이 호출하지 않았다.

2026-05-04에는 TJ님이 로컬 `backend/.env`에 Test Event Code를 넣은 뒤 재개했다.

## No-Send / No-Write 감사

| 항목 | 결과 |
|---|---|
| TikTok Events API production send | 0건 |
| TikTok Test Events send | 1건 |
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

추천 점수: 88%

무엇을 하는가:
- 지금 열려 있는 TikTok Events Manager `biocom_tiktok_web_pixel`의 Test events 화면에서 서버 이벤트가 들어왔는지 확인한다.

왜 하는가:
- TikTok API 응답은 `OK`지만, 실제 UI에 `Purchase`와 `event_id`가 표시되는지까지 봐야 Test Events smoke를 닫을 수 있다.
- Codex는 TJ님 로그인 세션이 있는 TikTok Events Manager UI를 직접 볼 수 없어서 이 확인은 TJ님이 해야 한다.

어떻게 하는가:
1. 현재 화면에서 Data source가 `biocom_tiktok_web_pixel`이고 Pixel ID가 `D5G8FTBC77UAODHQ0KOG`인지 확인한다.
2. `Test events` 탭 하단의 `Test event activity` 영역을 본다.
3. 시간 기준으로 `2026-05-04 11:42 KST` 전후의 서버 이벤트를 찾는다.
4. event name이 `Purchase`인지 확인한다.
5. 상세를 열 수 있으면 `event_id=Purchase_o202605033af504ba376d9`가 보이는지 확인한다.
6. 보이면 스크린샷이나 텍스트로 “Purchase 보임 / event_id 보임”만 알려준다. token이나 test code는 보내지 않는다.

성공 기준:
- Test Events 화면에 `Purchase` 1건이 보인다.
- 가능한 경우 `event_id=Purchase_o202605033af504ba376d9`가 보인다.
- production event로 보인다는 문구나 경고가 없다.

실패 시 확인점:
- 이벤트가 안 보이면 Test Events UI 반영 지연, test code 적용 방식, payload field warning, token 권한 범위를 다시 본다.
- `Purchase`가 아닌 다른 이름으로 보이면 event name mapping을 다시 검토한다.
- production 데이터처럼 보이면 즉시 중단하고 Test Events only 설계를 재검토한다.

### 2. Codex가 할 일

추천 점수: 84%

무엇을 하는가:
- 이번 실행 결과를 기준으로 문서, audit, commit/push를 닫고, TJ님 UI 확인 결과가 오면 최종 verdict를 업데이트한다.

왜 하는가:
- API는 성공했지만, 화면 확인 전에는 “TikTok Events Manager에서 사람이 볼 수 있는 수신 성공”까지 완료됐다고 말하면 안 된다.
- production Events API send는 아직 Red Lane이므로 다음 승인 게이트를 명확히 분리해야 한다.

어떻게 하는가:
1. 본 문서에 API 응답, VM read-only 사후 감사, 금지 범위 유지 여부를 기록한다.
2. `python3 scripts/validate_wiki_links.py`와 `git diff --check`를 실행한다.
3. 가능한 범위에서 harness preflight를 실행한다. 기존 unrelated dirty warning은 분리해서 보고한다.
4. 변경 파일이 결과 문서와 승인 문서 범위로 제한됐는지 확인한다.
5. audit 후 commit/push한다.

성공 기준:
- 문서에 secret 평문 없음.
- TikTok Test Events 호출은 총 1건.
- VM SQLite shadow row는 `send_candidate=false`, `platform_send_status=not_sent`.
- 운영DB PostgreSQL write 0건.
- GTM/Purchase Guard/GA4/Meta/Google 변경 0건.

실패 시 확인점:
- 문서에 token/test code가 노출되면 즉시 수정한다.
- audit가 이번 sprint와 무관한 dirty file 때문에 경고를 내면 범위를 분리해서 기록한다.
- 이번 sprint 파일 자체에 wiki link 또는 whitespace 문제가 있으면 수정 후 재검증한다.

## Auditor verdict

Auditor verdict: PASS_WITH_NOTES

TikTok API 기준 Test Events endpoint 1건 전송은 성공했다.

남은 note:
- TJ님이 TikTok Events Manager UI에서 `Purchase`와 `event_id=Purchase_o202605033af504ba376d9` 표시를 확인해야 한다.
- Production Events API send는 여전히 Red Lane이며, 이번 결과만으로 켜지 않는다.
