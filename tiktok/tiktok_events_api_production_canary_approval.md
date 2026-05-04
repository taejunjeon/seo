# TikTok Events API Production Canary 1-Order Approval

작성 시각: 2026-05-04 11:54 KST
요청 유형: Red Lane 승인 요청
대상: TikTok Events API production endpoint, `biocom_tiktok_web_pixel`
데이터/DB 위치:
- 운영DB: 개발팀 관리 PostgreSQL `dashboard.public.tb_iamweb_users`, write 금지
- TJ 관리 Attribution VM: `att.ainativeos.net` 내부 SQLite `CRM_LOCAL_DB_PATH#tiktok_events_api_shadow_candidates`, read-only 검증만
- 로컬 개발 DB: `/Users/vibetj/coding/seo/backend/data/crm.sqlite3`, 이번 승인 실행 대상 아님
운영DB 영향: 없음
외부 전환 전송: 있음. TikTok Events API production endpoint 1건
Codex 진행 추천 자신감: 72%
다른 에이전트 검증: 권장. 이유는 광고 플랫폼 production conversion send가 직접 ROAS와 최적화 신호에 영향을 줄 수 있기 때문이다.

```yaml
harness_preflight:
  common_harness_read: "AGENTS.md, CLAUDE.md, harness/common/HARNESS_GUIDELINES.md, harness/common/AUTONOMY_POLICY.md, harness/common/REPORTING_TEMPLATE.md"
  project_harness_read: "harness/tiktok/LESSONS.md"
  required_context_docs:
    - "docurule.md"
    - "tiktok/tiktok_events_api_dedup_rules.md"
    - "tiktok/tiktok_events_api_shadow_candidate_review_20260503.md"
    - "tiktok/tiktok_events_api_test_events_smoke_result_20260503.md"
    - "tiktok/tiktok_events_api_test_events_approval.md"
  lane: "Green documentation for Red Lane approval; requested execution lane is Red"
  allowed_actions:
    - "승인 문서 작성"
    - "공식 문서 확인"
    - "TJ 관리 Attribution VM SQLite read-only 후보 확인"
    - "payload preview 작성"
    - "audit"
    - "commit/push"
  forbidden_actions:
    - "TikTok Events API production send"
    - "TikTok Events API Test Events send"
    - "GA4/Meta/Google 전환 전송"
    - "GTM 변경"
    - "Purchase Guard 변경"
    - "firstTouch strict 승격"
    - "payment_success top-level attribution overwrite"
    - "개발팀 관리 운영DB PostgreSQL write"
    - "TJ 관리 Attribution VM SQLite write"
    - "scheduler/dispatcher 상시 ON"
  source_window_freshness_confidence:
    source: "TikTok 공식 문서 + TJ 관리 Attribution VM SQLite shadow row + Test Events PASS result"
    window: "candidate_version=2026-05-03.shadow.v1, order_no=202605036519253, browser first_observed_at=2026-05-03 12:01:40 KST"
    freshness: "2026-05-04 11:54 KST read-only 확인"
    site: "biocom"
    confidence: 0.72
```

## 10초 요약

이 문서는 TikTok Events API production 전송을 **전체 ON** 하자는 문서가 아니다.

승인 요청은 이미 Test Events에서 성공한 A등급 후보 주문 1건만 production endpoint로 보내는 canary다. 목적은 TikTok이 실제 production 환경에서도 같은 `Purchase`와 `event_id`를 받는지, 그리고 browser Pixel과 server event의 dedup 진단에 문제가 없는지 확인하는 것이다.

단, TikTok Events API production send는 광고 플랫폼 전환값에 직접 영향을 줄 수 있으므로 Red Lane이다. TJ님 명시 승인 전에는 실행하지 않는다.

## 한 줄 결론

Codex 판단은 “1건 production canary는 조건부 승인 검토 가능”이다.

추천 자신감은 72%다. Test Events는 성공했지만, production dedup diagnostics를 아직 보지 못했기 때문에 전체 운영 전송은 아직 35% 이하로 보류한다.

## 무엇을 하는가

승인되면 Codex는 TikTok Events API production endpoint로 아래 주문 1건만 전송한다.

| 항목 | 값 |
|---|---|
| order_no | `202605036519253` |
| order_code | `o202605033af504ba376d9` |
| event | `Purchase` |
| event_id | `Purchase_o202605033af504ba376d9` |
| amount | 484,500 KRW |
| payment_status | confirmed |
| payment_decision_branch | `allow_purchase` |
| Pixel ID | `D5G8FTBC77UAODHQ0KOG` |
| 후보 등급 | A |
| VM row 상태 | `send_candidate=false`, `platform_send_status=not_sent` 유지 |

실행 방식:
- 로컬 one-off Node command 또는 승인된 1회용 script로만 실행한다.
- backend deploy는 하지 않는다.
- scheduler/dispatcher는 켜지 않는다.
- VM SQLite row는 write하지 않는다.
- 결과는 문서에만 기록한다.

## 왜 하는가

Test Events 성공만으로는 production dedup이 안전하다고 말할 수 없다.

확인해야 할 질문은 세 가지다.

1. TikTok production endpoint가 같은 payload를 정상 수신하는가.
2. `Purchase` + `Purchase_o...` 조합이 browser Pixel event와 dedup 가능한 형태로 진단되는가.
3. 서버 이벤트를 1건 보냈을 때 TikTok Ads/Events Manager에서 중복 구매나 심각한 diagnostics가 생기지 않는가.

이 1건을 확인해야 다음에 “production Events API를 계속 켤지”가 아니라 “아직 켜면 안 되는지”를 판단할 수 있다.

## 데이터가 충분한가

1건 canary 판단에는 충분하다.

근거:
- Test Events endpoint 1건 성공: `HTTP 200`, `code=0`, `message=OK`
- TikTok Events Manager UI 확인 완료: `Purchase`, `Server`, `event_id=Purchase_o202605033af504ba376d9`
- Shadow 후보 row 17건 중 A등급 5건 확인
- 이번 후보는 A등급 1순위
- VM shadow row는 confirmed, allow_purchase, dedup_ready, no PII 조건을 만족

전체 운영 전송 판단에는 아직 부족하다.

부족한 것:
- production dedup diagnostics 결과
- production event가 실제 TikTok Ads 구매 수를 중복 증가시키지 않는지에 대한 24시간 관찰
- A등급 외 B/C 후보 정책
- pending 가상계좌가 나중에 confirmed로 바뀌는 케이스의 별도 규칙
- server user match key, `_ttp`, IP, user agent 포함 정책

## 중요한 시간 조건

TikTok 공식 dedup 문서는 Pixel과 Events API가 같은 conversion을 중복 보고할 때 동일 event와 event_id가 필요하다고 안내한다. 또한 Pixel과 Events API overlap은 첫 이벤트 후 5분 이후부터 48시간 window 안에서 처리된다고 설명한다.

이번 후보의 browser Pixel 최초 관측 시각:
- UTC: `2026-05-03T03:01:40.316Z`
- KST: `2026-05-03 12:01:40 KST`

권장 실행 마감:
- `2026-05-05 12:01:40 KST` 전

Hard rule:
- 이 시각을 넘기면 이 주문으로 production canary를 하지 않는다.
- 시각을 넘기면 새 A등급 confirmed 주문을 찾아서 같은 방식으로 approval 문서를 갱신한다.

## 공식 근거

확인한 공식 문서:
- TikTok Events API는 웹 연결에서 기존 Pixel과 함께 쓰는 구성이 권장된다. 참고: https://ads.tiktok.com/help/article/events-api?lang=en
- Pixel과 Events API가 같은 conversion을 보내면 `event_id`를 양쪽에 공유해야 dedup이 된다. 참고: https://ads.tiktok.com/help/article/event-deduplication?lang=en
- `Purchase`는 TikTok 표준 이벤트 코드이며 구매 완료 이벤트다. 참고: https://ads.tiktok.com/help/article/standard-events-parameters?lang=en

바이오컴 적용:
- browser Pixel 최종 event_id는 `Purchase_{order_code}` 패턴이다.
- server event도 같은 `Purchase_o202605033af504ba376d9`를 써야 한다.
- raw order code `o202605033af504ba376d9`만 보내면 dedup 실패 위험이 있다.

## Payload Preview

주의:
- 아래는 승인 검토용 preview다.
- 실제 실행 시 `Access-Token` 값은 출력하지 않는다.
- production payload에는 `test_event_code`를 절대 넣지 않는다.
- raw email, raw phone, name, address, 주문 메모는 넣지 않는다.

```json
{
  "event_source": "web",
  "event_source_id": "D5G8FTBC77UAODHQ0KOG",
  "data": [
    {
      "event": "Purchase",
      "event_time": 1777777300,
      "event_id": "Purchase_o202605033af504ba376d9",
      "page": {
        "url": "https://biocom.kr/shop_payment_complete?order_code=o202605033af504ba376d9&order_no=202605036519253"
      },
      "properties": {
        "currency": "KRW",
        "value": 484500,
        "content_type": "product",
        "contents": [
          {
            "content_id": "order_202605036519253",
            "content_name": "TikTok Production Canary order",
            "price": 484500,
            "quantity": 1
          }
        ],
        "order_id": "202605036519253",
        "status": "confirmed"
      }
    }
  ]
}
```

event_time 정책:
- production canary에서는 원칙적으로 실제 browser/payment event 시각을 쓴다.
- 단, TikTok API가 과거 event_time을 reject하면 즉시 중단한다.
- reject 후 현재 시각으로 재전송하지 않는다. 2건 이상 전송 금지 때문이다.

## 허용 범위

승인 후 허용:
- TikTok Events API production endpoint 1회 호출
- event는 `Purchase`만 사용
- event_id는 `Purchase_o202605033af504ba376d9`만 사용
- 대상 주문은 `202605036519253` 1건만 사용
- 실행 전 TJ 관리 Attribution VM SQLite read-only 재확인
- 실행 전 payload에 `test_event_code` 없음 확인
- 실행 후 TikTok API response 기록
- 실행 후 TikTok Events Manager Overview/Diagnostics 확인
- 실행 후 `/ads/tiktok`과 기존 원장 read-only 확인
- 결과 문서 업데이트
- audit
- commit/push

허용하지 않는 것:
- second retry
- `CompletePayment` 대체 전송
- B/C 후보 전송
- pending/canceled/not_confirmed 전송
- 가상계좌 pending 또는 pending 이력 후보 전송
- no TikTok evidence confirmed order 전송

## 금지 범위

아래는 승인 후에도 금지한다.

| 금지 | 이유 |
|---|---|
| 2건 이상 TikTok production send | smoke 범위 초과 |
| Purchase 실패 후 `CompletePayment` 자동 전송 | event mapping 오염 |
| TikTok Test Events send 추가 | 이번 문서는 production canary 승인 |
| GA4/Meta/Google 전환 전송 | 다른 플랫폼 전환값 오염 방지 |
| GTM 변경 | browser tracking layer 영향 방지 |
| Purchase Guard 변경 | pending 차단 로직 영향 방지 |
| firstTouch strict 승격 | 내부 ROAS 기준 오염 방지 |
| payment_success top-level attribution overwrite | 원장 기준 오염 방지 |
| 개발팀 관리 운영DB PostgreSQL write | 운영DB는 개발팀 관리 |
| TJ 관리 Attribution VM SQLite write | canary 결과는 문서에만 기록 |
| scheduler/dispatcher 상시 ON | 자동 전송 위험 |
| raw PII 또는 hashed email/phone 추가 | match key 정책 미승인 |
| `test_event_code`를 production payload에 포함 | production 검증 목적과 충돌 |

## Hard Fail

아래 중 하나라도 해당하면 즉시 중단한다.

1. 현재 시각이 `2026-05-05 12:01:40 KST`를 넘었다.
2. VM shadow row가 `payment_status=confirmed`가 아니다.
3. VM shadow row가 `payment_decision_branch=allow_purchase`가 아니다.
4. VM shadow row가 `dedup_ready=1`이 아니다.
5. VM shadow row가 `eligible_for_future_send=1`이 아니다.
6. `send_candidate=true`나 `platform_send_status != not_sent` row가 이미 있다.
7. payload에 `test_event_code`가 들어간다.
8. payload에 raw email, raw phone, name, address, 주문 메모가 들어간다.
9. event가 `Purchase`가 아니다.
10. event_id가 `Purchase_o202605033af504ba376d9`가 아니다.
11. Pixel ID가 `D5G8FTBC77UAODHQ0KOG`가 아니다.
12. TikTok API가 reject한다.
13. reject 후 다른 event나 timestamp로 재시도해야 한다.
14. TikTok UI에서 production event가 중복 구매처럼 즉시 보이는 강한 징후가 있다.
15. 운영DB write가 필요해진다.

## Success Criteria

즉시 성공 기준:
- TikTok production endpoint 호출은 정확히 1건이다.
- TikTok API 응답이 `HTTP 200`, `code=0`, `message=OK`다.
- response와 request_id를 문서에 기록한다.
- token/test code는 문서나 로그에 평문으로 남지 않는다.
- VM shadow row는 계속 `send_candidate=false`, `platform_send_status=not_sent`다.
- 운영DB PostgreSQL write는 0건이다.
- GTM/Purchase Guard/GA4/Meta/Google 변경은 0건이다.

24시간 관찰 성공 기준:
- TikTok Events Manager Diagnostics에 event_id mismatch, duplicate, policy 관련 심각 오류가 없다.
- TikTok Events Manager에서 server `Purchase`가 해당 event_id로 확인된다.
- TikTok Ads 구매가 이 1건 때문에 명백하게 2건으로 중복 증가했다는 징후가 없다.
- `/ads/tiktok` 내부 strict/firstTouch/platform-only assisted 구분이 유지된다.

성공해도 아직 하지 않는 것:
- 자동 dispatcher ON
- eligible 15건 일괄 전송
- B/C 후보 전송
- pending 가상계좌 입금 확정 케이스 전송
- match key 확대

## Rollback

TikTok production event는 보낸 뒤 되돌릴 수 없다.

따라서 rollback은 “취소”가 아니라 “확산 차단”이다.

즉시 rollback/중단:
1. 추가 전송 0건 유지
2. scheduler/dispatcher OFF 확인
3. local one-off script 삭제 또는 비활성화
4. token/test code가 로그에 남지 않았는지 확인
5. 결과 문서에 FAIL_BLOCKED 기록
6. 이후 production send 승인 논의를 중단하고 원인 분석으로 전환

## 승인 문구

승인하려면 아래처럼 승인한다.

```text
TikTok Events API Production Canary 1-Order sprint를 승인합니다.

승인 범위:
- 후보 주문 202605036519253 / o202605033af504ba376d9 1건만 TikTok Events API production endpoint로 전송
- event=Purchase
- event_id=Purchase_o202605033af504ba376d9
- 호출 1건 이하
- 실행 전 TJ 관리 Attribution VM SQLite read-only 재확인
- production payload에 test_event_code 없음 확인
- raw PII 없음 확인
- 실행 후 TikTok response / Events Manager / Diagnostics / VM row read-only 확인
- 결과 문서 업데이트
- audit
- commit/push

금지:
- 2건 이상 전송
- retry 또는 CompletePayment 대체 전송
- TikTok Test Events 추가 전송
- GA4/Meta/Google 전환 전송
- GTM 변경
- Purchase Guard 변경
- firstTouch strict 승격
- payment_success top-level attribution overwrite
- 개발팀 관리 운영DB PostgreSQL write
- TJ 관리 Attribution VM SQLite write
- scheduler/dispatcher 상시 ON
- raw PII 또는 hashed email/phone 추가

조건:
- 2026-05-05 12:01:40 KST 이전에만 이 후보로 실행
- 이후에는 새 A등급 후보로 승인 문서 갱신
```

## 승인 후 다음 액션

### 1. Codex가 할 일

추천 점수: 72%

무엇을 하는가:
- 승인 문구가 오면 기존 후보 row를 다시 read-only 확인하고 TikTok production endpoint로 1건만 보낸다.

왜 하는가:
- Test Events 성공 다음 단계로, 실제 production 환경에서도 event_id와 dedup 조건이 유지되는지 보기 위해서다.

어떻게 하는가:
1. 현재 시각이 `2026-05-05 12:01:40 KST` 전인지 확인한다.
2. TJ 관리 Attribution VM SQLite에서 후보 row가 여전히 A등급 조건인지 read-only 확인한다.
3. payload에 `test_event_code`와 raw PII가 없는지 확인한다.
4. TikTok production endpoint를 1회 호출한다.
5. 응답과 request_id를 문서에 기록한다.
6. TikTok Events Manager와 Diagnostics 확인 항목을 TJ님에게 구체적으로 안내한다.
7. VM shadow row가 unchanged인지 read-only 확인한다.
8. 결과 문서와 audit를 commit/push한다.

성공 기준:
- API `code=0`
- 호출 1건
- no DB write
- no platform retry
- no scheduler

실패 시 해석:
- API reject면 재시도하지 않고 payload/event name/token 권한을 재검토한다.
- Diagnostics 경고가 뜨면 production 확대를 중단한다.

승인 필요:
- YES. Red Lane 명시 승인 필요.

다른 에이전트 검증:
- 권장. 이유는 production conversion send이고, 잘못되면 TikTok ROAS와 최적화 신호가 오염될 수 있다.

### 2. TJ님이 할 일

추천 점수: 70%

무엇을 하는가:
- 위 승인 문구를 그대로 승인할지, 아니면 canary도 보류할지 결정한다.

왜 하는가:
- production Events API send는 되돌릴 수 없는 외부 전환 전송이다.

어떻게 하는가:
1. 이 문서의 `허용 범위`, `금지 범위`, `Hard Fail`, `Rollback`을 확인한다.
2. 1건 canary를 진행하려면 승인 문구를 그대로 보낸다.
3. 불안하면 “보류. 새 주문으로 48시간 window 안에서 다시 승인 문서 작성”이라고 지시한다.

성공 기준:
- 승인/보류 판단이 명확하다.

실패 시 해석:
- 승인 범위가 애매하면 Codex는 production send를 실행하지 않는다.

## 전체 운영 전송은 왜 아직 아닌가

전체 운영 전송 추천 점수: 35%

이유:
- A등급 5건만 상대적으로 안전하다.
- B/C 후보는 UTM 혼합 또는 Guard unknown release가 있다.
- pending 가상계좌가 나중에 confirmed가 되는 케이스의 별도 정책이 아직 부족하다.
- production dedup diagnostics를 아직 보지 않았다.
- scheduler/dispatcher kill switch 설계가 아직 approval 수준으로 잠기지 않았다.

따라서 이번 문서는 1건 canary만 다룬다.

## Auditor verdict

Auditor verdict: NEEDS_HUMAN_APPROVAL

문서 작성은 Green Lane으로 완료했다.

실행은 Red Lane이다. TJ님 명시 승인 전 TikTok Events API production endpoint를 호출하지 않는다.
