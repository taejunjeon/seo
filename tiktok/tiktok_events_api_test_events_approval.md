# TikTok Events API Test Events Only Smoke

작성 시각: 2026-05-03 12:23 KST
요청 유형: Yellow Lane 승인 요청 초안
대상: TikTok Events Manager Test Events + TJ 관리 Attribution VM
데이터/DB 위치:
- 운영DB: 개발팀 관리 PostgreSQL `dashboard.public.tb_iamweb_users`, write 금지
- TJ 관리 Attribution VM: `att.ainativeos.net` 내부 SQLite, read-only 후보 조회 및 smoke 결과 기록 후보
- 로컬 개발 DB: `/Users/vibetj/coding/seo/backend/data/crm.sqlite3`, 필요 시 로컬 dry-run만
운영DB 영향: 없음
외부 전환 전송: TikTok Test Events endpoint only. Production Events API send 금지
Codex 진행 추천 자신감: 78%

```yaml
harness_preflight:
  common_harness_read: "harness/common/HARNESS_GUIDELINES.md, harness/common/AUTONOMY_POLICY.md, harness/common/REPORTING_TEMPLATE.md"
  project_harness_read: "harness/tiktok/LESSONS.md"
  required_context_docs:
    - "AGENTS.md"
    - "tiktok/tiktok_events_api_shadow_candidate_review_20260503.md"
    - "tiktok/tiktok_events_api_shadow_ledger_vm_dry_run_result.md"
    - "tiktok/tiktok_events_api_shadow_ledger_design.md"
  lane: "Yellow"
  allowed_actions:
    - "TikTok Events Manager Test Event Code 확인"
    - "Events API token 권한 확인"
    - "Test Events endpoint로 후보 1건 전송"
    - "전송 전후 VM SQLite read-only 확인"
    - "TikTok Events Manager Test Events 화면 수신 확인"
    - "결과 문서 업데이트"
    - "audit"
    - "commit/push"
  forbidden_actions:
    - "TikTok Events API production send"
    - "GA4/Meta/Google 전환 전송"
    - "GTM 변경"
    - "Purchase Guard 변경"
    - "firstTouch strict 승격"
    - "payment_success top-level attribution overwrite"
    - "개발팀 관리 운영DB PostgreSQL write"
    - "scheduler/dispatcher 상시 ON"
  source_window_freshness_confidence:
    source: "TJ 관리 Attribution VM SQLite tiktok_events_api_shadow_candidates + TikTok Events Manager Test Events"
    window: "candidate_version=2026-05-03.shadow.v1 중 A 등급 1건"
    freshness: "승인 후 실행 시각 기준"
    site: "biocom"
    confidence: 0.78
```

## 한 줄 결론

이 승인안은 TikTok Events API production send가 아니라 Test Events 화면에만 1건을 보내는 smoke test다.

목표는 TikTok이 `pixel_code`, `event`, `event_id` 조합을 받아들이는지와 dedup 후보 구조가 맞는지 확인하는 것이다.

## 무엇을 하는가

1. TJ님이 TikTok Events Manager에서 Test Event Code를 확인한다.
2. Codex가 A 등급 후보 1건의 payload를 Test Events 전용으로만 만든다.
3. TikTok Events API Test Events endpoint로 1건만 보낸다.
4. TikTok Events Manager Test Events 화면에서 수신 여부를 확인한다.
5. VM shadow row는 계속 `send_candidate=false`, `platform_send_status=not_sent`로 유지한다.

## 왜 하는가

production send 전에는 아래를 실제로 확인해야 한다.

- TikTok API token 권한이 맞는가
- Pixel/Data source가 맞는가
- event name을 `Purchase`로 보낼 수 있는가
- event_id `Purchase_{order_code}`가 수신되는가
- Test Events 수신이 되더라도 실제 최적화 신호로 쓰지 않는가

## 필요한 TJ 정보

Codex가 대신할 수 있는 것:
- VM SQLite 후보 조회
- payload preview 생성
- Test Events only 전송 스크립트 초안 작성
- 전송 후 로그/문서 정리

TJ님 확인이 필요한 것:

| 항목 | 왜 필요한가 | 어디에서 확인하나 |
|---|---|---|
| Test Event Code | Test Events 화면에만 표시하려면 필요 | TikTok Events Manager -> 해당 Pixel/Data source -> Test Events |
| Events API Access Token | 서버에서 Events API를 호출하려면 필요 | TikTok Events Manager 또는 Business API 앱 권한 |
| Pixel/Data source 확인 | `D5G8FTBC77UAODHQ0KOG`가 맞는지 확인 | TikTok Events Manager -> Data Sources |
| Test Events 화면 수신 확인 | Codex가 UI 접근 권한이 없으면 TJ님 확인 필요 | TikTok Events Manager -> Test Events |

보안:
- token은 문서에 쓰지 않는다.
- token은 `.env` 또는 VM secret 경로에만 둔다.
- Test Event Code는 운영에 남기지 않는다.

## Test Event Code 필요 여부

필요하다.

이유:
- 이번 sprint는 production Events API send가 아니다.
- Test Events 화면에만 뜨게 하려면 Test Event Code 또는 TikTok이 요구하는 test parameter가 필요하다.
- Test Event Code 없이 보내면 production 이벤트로 처리될 위험이 있어 금지한다.

## Events API token 필요 여부

필요하다.

이유:
- Events API 호출은 Pixel code만으로 되지 않는다.
- Access token 권한이 맞는지 확인해야 한다.
- 권한이 없으면 Test Events 단계에서 멈추고 production send 검토로 넘어가지 않는다.

## Event Name 후보

| 후보 | 우선순위 | 이유 | 주의 |
|---|---:|---|---|
| `Purchase` | 1 | 현재 브라우저 TikTok Pixel Helper와 VM guard 로그의 실제 event name이 `Purchase`다. dedup은 동일 event + 동일 event_id가 필요하므로 Test Events에서도 먼저 이 값을 검증한다 | TikTok Events API가 reject하면 즉시 중단하고 mapping 재검토 |
| `CompletePayment` | 2 | TikTok 문서/파트너 구현 예시에서 구매 계열 표준 이벤트로 자주 쓰인다 | 브라우저가 `Purchase`를 보내는 현재 구조에서는 `CompletePayment`로 보내면 dedup이 안 될 수 있으므로 production 후보가 아니다 |

## Test Payload 후보 1건

실제 전송 전 payload는 한 번 더 생성 시각과 test code를 붙여 검증한다.

```json
{
  "pixel_code": "D5G8FTBC77UAODHQ0KOG",
  "event": "Purchase",
  "event_id": "Purchase_o202605033af504ba376d9",
  "timestamp_source": "attribution_ledger.payment_success.logged_at",
  "properties": {
    "currency": "KRW",
    "value": 484500,
    "content_type": "product",
    "order_id": "202605036519253"
  },
  "context_preview": {
    "has_ttp": false,
    "has_ttclid": true,
    "has_user_agent": false,
    "has_ip": false,
    "raw_pii_included": false
  },
  "send_mode": "test_events_only",
  "send_candidate": false,
  "platform_send_status": "not_sent_until_actual_test_call"
}
```

후보 주문:
- order_no: `202605036519253`
- order_code: `o202605033af504ba376d9`
- amount: 484,500 KRW
- 등급: A
- 이유: confirmed, `released_confirmed_purchase`, `allow_purchase`, TikTok UTM, ttclid, referrer, metadata match, dedup ready

## Event ID Dedup 확인 방식

확인할 값:

| 항목 | 값 |
|---|---|
| browser Pixel event name | `Purchase` |
| server Test Events event name | `Purchase` 우선 |
| browser/server event_id | `Purchase_o202605033af504ba376d9` |
| pixel code | `D5G8FTBC77UAODHQ0KOG` |

성공 해석:
- Test Events 화면에 같은 event name과 event_id가 보이면 schema와 수신은 통과다.

아직 성공으로 보지 않는 것:
- production dedup 정상
- optimization 신호 개선
- ROAS 신뢰도 상승

이유:
- Test Events는 production send가 아니다.
- 현재 payload preview에는 `_ttp`, user agent, IP가 없다.
- 실제 dedup diagnostics는 production 또는 별도 진단 화면에서만 확인될 수 있다.

## TikTok Events Manager 확인 화면

TJ님이 확인할 화면:

1. TikTok Ads Manager 또는 Events Manager 접속
2. Data Sources 또는 Event Sources에서 `biocom_tiktok_web_pixel` 선택
3. Pixel ID 또는 code가 `D5G8FTBC77UAODHQ0KOG`인지 확인
4. Test Events 탭으로 이동
5. Test Event Code 복사
6. Codex 실행 후 Test Events 화면에 `Purchase`와 `event_id=Purchase_o202605033af504ba376d9`가 표시되는지 확인

Codex가 대신 못 하는 이유:
- 현재 Codex는 TJ님 로그인 세션이 있는 TikTok Events Manager UI에 직접 접근할 수 없다.
- token/code는 계정 보안 정보라 대화나 문서에 노출하면 안 된다.

## Success Criteria

성공 기준:

- Test Events endpoint 호출은 1건 이하
- Production Events API send 0건
- Test Events 화면에 `Purchase` 1건 표시
- event_id가 `Purchase_o202605033af504ba376d9`로 표시
- VM shadow row는 계속 `send_candidate=false`
- VM shadow row는 계속 `platform_send_status=not_sent`
- GA4/Meta/Google 전송 0건
- GTM/Purchase Guard 변경 0건
- 운영DB PostgreSQL write 0건

## Stop Criteria / Hard Fail

아래 중 하나라도 발생하면 즉시 중단한다.

- Test Event Code 없이 send 필요
- Access token 권한 불명확
- event name `Purchase`가 reject되고 대체 mapping이 필요
- TikTok Events Manager에 production event로 보이는 징후
- 2건 이상 전송 필요
- pending/canceled/not_confirmed 주문을 보내야 하는 상황
- raw PII payload 필요
- VM shadow row를 `send_candidate=true`로 바꿔야 하는 상황
- 운영DB write 필요

## Rollback

Test Events는 외부 테스트 수신이므로 DB rollback 대상은 없다.

다만 아래를 확인한다.

1. VM shadow row가 변경되지 않았는지 확인
2. test code를 env나 문서에서 제거
3. 관련 임시 로그에 token이 남지 않았는지 확인
4. production dispatcher가 없고 scheduler가 OFF인지 확인

## 공식 문서 근거

TikTok 공식 도움말 기준:

- Events API는 광고주 서버와 TikTok 사이의 서버 연결이며, 웹 이벤트에서는 Pixel과 Events API를 함께 쓰는 방식을 안내한다. 참고: https://ads.tiktok.com/help/article/events-api
- Pixel과 Events API가 같은 전환을 공유하면 동일 event와 event_id를 사용해야 dedup이 가능하다. TikTok은 48시간 dedup window와 Pixel/Events API overlap 조건을 안내한다. 참고: https://ads.tiktok.com/help/article?aid=10012410

## 승인 문구

승인하려면 아래처럼 승인한다.

```text
TikTok Events API Test Events Only Smoke sprint를 승인합니다.

허용:
- TikTok Events Manager Test Event Code 확인
- Events API token 권한 확인
- A 등급 후보 1건 Test Events endpoint 전송
- Test Events 화면 수신 확인
- VM shadow row read-only 검증
- 문서 업데이트
- audit
- commit/push

금지:
- TikTok Events API production send
- 2건 이상 전송
- GA4/Meta/Google 전환 전송
- GTM 변경
- Purchase Guard 변경
- firstTouch strict 승격
- payment_success top-level attribution overwrite
- 개발팀 관리 운영DB PostgreSQL write
- scheduler/dispatcher 상시 ON
```

## Auditor verdict

Auditor verdict: NEEDS_HUMAN_APPROVAL

이 문서는 승인 요청 초안이다. 문서 작성은 Green Lane으로 완료했지만, TikTok Test Events endpoint 호출은 Yellow Lane이므로 TJ님 명시 승인 전 실행하지 않는다.

Production Events API send는 계속 Red Lane이다.

## 실행 결과

2026-05-03 TJ님이 Yellow Lane sprint를 승인했다.

Codex는 A등급 후보 `202605036519253` / `o202605033af504ba376d9`를 VM SQLite에서 read-only로 검증했지만, Test Event Code가 로컬 `backend/.env`와 TJ 관리 Attribution VM `backend/.env` 어디에도 없어 endpoint 호출 전 중단했다.

결과 문서: `tiktok/tiktok_events_api_test_events_smoke_result_20260503.md`

핵심 결과:
- TikTok Events API production send 0건
- TikTok Test Events send 0건
- GA4/Meta/Google send 0건
- GTM 변경 없음
- Purchase Guard 변경 없음
- 개발팀 관리 운영DB PostgreSQL write 없음
- VM shadow row `send_candidate=false`, `platform_send_status=not_sent` 유지
- Auditor verdict: `FAIL_BLOCKED`

## 2026-05-04 재개 실행 결과

2026-05-04 11:42 KST에 TJ님이 로컬 `backend/.env`에 pixel id, access token, Test Event Code를 준비했다고 알려줬다. Codex는 값을 출력하지 않고 존재 여부와 길이만 확인했다.

실행 결과:
- 대상 후보: `202605036519253` / `o202605033af504ba376d9`
- event: `Purchase`
- event_id: `Purchase_o202605033af504ba376d9`
- endpoint: `POST https://business-api.tiktok.com/open_api/v1.3/event/track/`
- 호출 수: 1건
- TikTok API 응답: `HTTP 200`, `code=0`, `message=OK`
- request_id: `20260504024205A4B1A91F85C7E4D1106A`

사후 감사:
- TikTok Events API production send 0건
- TikTok Test Events send 1건
- GA4/Meta/Google send 0건
- GTM 변경 없음
- Purchase Guard 변경 없음
- firstTouch strict 승격 없음
- payment_success top-level attribution overwrite 없음
- 개발팀 관리 운영DB PostgreSQL write 없음
- scheduler/dispatcher 상시 ON 없음
- VM shadow row `send_candidate=false` 유지
- VM shadow row `platform_send_status=not_sent` 유지
- VM shadow row `pii_in_payload=0` 유지

현재 verdict:
- `PASS`

TJ님 UI 확인:
- Pixel ID: `D5G8FTBC77UAODHQ0KOG`
- Test Events 문구: `Test events will not be included in actual data`
- event: `Purchase`
- received time: `2026-05-04 11:42:05 (UTC+09:00) Asia/Seoul`
- connection method: `Server`
- URL: `https://biocom.kr/shop_payment_complete?order_code=o202605033af504ba376d9&order_no=202605036519253`
- setup method: `Custom code`
- event_id: `Purchase_o202605033af504ba376d9`
- currency/value: `KRW` / `484500`

남은 note:
- Production Events API send는 계속 Red Lane이다. 이번 Test Events 성공만으로 운영 전송을 켜지 않는다.
