# TikTok Events API Production Canary 1-Order Result

작성 시각: 2026-05-04 12:58 KST
Project: TikTok ROAS 정합성 개선
Sprint: TikTok Events API Production Canary 1-Order
Lane: Red, TJ님 명시 승인 후 실행
Mode: production endpoint single-call canary
Auditor verdict: PASS_WITH_NOTES
현재 판정: TikTok Events API production endpoint 1건 호출 성공. TikTok API는 `HTTP 200`, `code=0`, `message=OK` 응답. VM shadow row는 unchanged. TikTok Events Manager Overview/Diagnostics UI 확인은 TJ님 확인 필요
진행 추천 점수: 72%

```yaml
harness_preflight:
  common_harness_read: "AGENTS.md, CLAUDE.md, harness/common/HARNESS_GUIDELINES.md, harness/common/AUTONOMY_POLICY.md, harness/common/REPORTING_TEMPLATE.md"
  project_harness_read: "harness/tiktok/LESSONS.md"
  required_context_docs:
    - "docurule.md"
    - "tiktok/tiktok_events_api_production_canary_approval.md"
    - "tiktok/tiktok_events_api_dedup_rules.md"
    - "tiktok/tiktok_events_api_shadow_candidate_review_20260503.md"
    - "tiktok/tiktok_events_api_test_events_smoke_result_20260503.md"
  lane: "Red"
  allowed_actions:
    - "후보 주문 202605036519253 / o202605033af504ba376d9 1건 production endpoint 전송"
    - "event=Purchase"
    - "event_id=Purchase_o202605033af504ba376d9"
    - "event_time=1777777300"
    - "VM shadow row read-only 사전/사후 확인"
    - "payload에 test_event_code/PII 없음 확인"
    - "결과 문서 업데이트"
    - "audit"
    - "commit/push"
  forbidden_actions:
    - "2건 이상 전송"
    - "retry"
    - "CompletePayment 대체 전송"
    - "현재 시각 event_time 재전송"
    - "TikTok Test Events 추가 전송"
    - "GA4/Meta/Google 전환 전송"
    - "GTM 변경"
    - "Purchase Guard 변경"
    - "firstTouch strict 승격"
    - "payment_success top-level attribution overwrite"
    - "개발팀 관리 운영DB PostgreSQL write"
    - "TJ 관리 Attribution VM SQLite write"
    - "scheduler/dispatcher 상시 ON"
    - "raw/hash PII 추가"
  source_window_freshness_confidence:
    source: "TikTok Events API response + TJ 관리 Attribution VM SQLite read-only audit"
    window: "order_no=202605036519253, order_code=o202605033af504ba376d9, production call at 2026-05-04 12:54:25 KST"
    freshness: "2026-05-04 12:58 KST"
    site: "biocom"
    confidence: 0.72
```

## 한 줄 결론

승인된 1건 production canary는 API 기준 성공했다.

하지만 이 결과만으로 TikTok Events API 전체 운영 전송을 켜면 안 된다. 남은 핵심 확인은 TikTok Events Manager Overview/Diagnostics에서 중복/경고가 없는지 보는 것이다.

## 완료한 것

| 항목 | 결과 | 근거 | 데이터/DB 위치 |
|---|---|---|---|
| 시간 조건 확인 | PASS | 실행 시각 `2026-05-04 12:54:25 KST`, 마감 `2026-05-05 12:01:40 KST` 이전 | 해당 없음 |
| VM shadow row 사전 확인 | PASS | confirmed, `allow_purchase`, `dedup_ready=1`, `eligible_for_future_send=1`, `send_candidate=0`, `platform_send_status=not_sent`, `pii_in_payload=0` | TJ 관리 Attribution VM SQLite |
| payload dry-run 1차 | FAIL_BLOCKED | `content_name` 키가 PII guard의 `name` 문자열에 걸림 | 로컬 dry-run |
| payload dry-run 2차 | PASS | `content_name` 제거 후 forbidden key 0건, `test_event_code` 없음, raw/hash PII 없음 | 로컬 dry-run |
| TikTok production endpoint 호출 | PASS | `HTTP 200`, `code=0`, `message=OK`, request_id `202605040354257C43426495E4F7D1DFA1` | TikTok 외부 API |
| VM shadow row 사후 확인 | PASS | row unchanged. `send_candidate=0`, `platform_send_status=not_sent`, `pii_in_payload=0` | TJ 관리 Attribution VM SQLite |

## 호출 정보

| 항목 | 값 |
|---|---|
| endpoint | `POST https://business-api.tiktok.com/open_api/v1.3/event/track/` |
| event | `Purchase` |
| event_id | `Purchase_o202605033af504ba376d9` |
| event_time | `1777777300` |
| event_time 기준 | `2026-05-03 12:01:40 KST` |
| Pixel ID | `D5G8...0KOG` |
| order_no | `202605036519253` |
| order_code | `o202605033af504ba376d9` |
| value/currency | `484500` / `KRW` |
| response | `HTTP 200`, `code=0`, `message=OK` |
| request_id | `202605040354257C43426495E4F7D1DFA1` |
| retry | 0건 |

## 실제 전송 payload 요약

secret과 Pixel ID 전체값은 문서에서 축약한다.

```json
{
  "event_source": "web",
  "event_source_id": "D5G8...0KOG",
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

preview 문서와 달라진 점:
- `content_name`을 제거했다.
- 이유: 승인 조건이 raw/hash `name` 추가 금지였고, dry-run guard가 `content_name` 키를 보수적으로 차단했기 때문이다.
- TikTok recommended parameter 일부를 줄였지만, canary 목적은 수신과 dedup event_id 확인이므로 안전성을 우선했다.

## No-Send / No-Write 감사

| 항목 | 결과 |
|---|---|
| TikTok Events API production send | 1건 |
| TikTok Test Events 추가 send | 0건 |
| retry | 0건 |
| `CompletePayment` 대체 전송 | 0건 |
| GA4/Meta/Google send | 0건 |
| GTM change | 없음 |
| Purchase Guard change | 없음 |
| firstTouch strict 승격 | 없음 |
| payment_success top-level overwrite | 없음 |
| 개발팀 관리 운영DB PostgreSQL write | 0건 |
| TJ 관리 Attribution VM SQLite write | 0건 |
| scheduler/dispatcher 상시 ON | 없음 |
| raw/hash PII 추가 | 없음 |

## VM Shadow Row 사후 상태

Source:
- TJ 관리 Attribution VM SQLite `CRM_LOCAL_DB_PATH#tiktok_events_api_shadow_candidates`

```json
{
  "order_no": "202605036519253",
  "order_code": "o202605033af504ba376d9",
  "value": 484500,
  "payment_status": "confirmed",
  "event_name": "Purchase",
  "server_event_id_candidate": "Purchase_o202605033af504ba376d9",
  "eligible_for_future_send": 1,
  "dedup_ready": 1,
  "send_candidate": 0,
  "platform_send_status": "not_sent",
  "pii_in_payload": 0,
  "updated_at": "2026-05-03T03:06:43.280Z"
}
```

해석:
- 승인 조건대로 VM SQLite에는 쓰지 않았다.
- `platform_send_status=not_sent`는 실제 TikTok 호출이 없었다는 뜻이 아니라, shadow 원장을 write하지 않았다는 뜻이다.
- 이번 production call 결과는 이 결과 문서에만 기록한다.

## 남은 것

Codex가 확인하지 못한 것:
- TikTok Events Manager Overview/Diagnostics UI
- production server event가 Events Manager에 어떻게 표시되는지
- dedup diagnostics에 event_id mismatch, duplicate, policy warning이 있는지
- TikTok Ads 보고서 구매 수가 이 1건 때문에 중복 증가하는지

Codex가 대신 못 하는 이유:
- TJ님 로그인 세션이 있는 TikTok UI 접근 권한이 없다.
- TikTok Ads/Events Manager의 production diagnostics는 UI에서 직접 확인해야 한다.

## 다음 액션

### 1. TJ님이 할 일

추천 점수: 88%

무엇을 하는가:
- TikTok Events Manager에서 production event 수신과 Diagnostics를 확인한다.

왜 하는가:
- API는 성공했지만, TikTok UI에서 중복/경고가 없는지 봐야 canary를 닫을 수 있다.

어떻게 하는가:
1. TikTok Events Manager에서 `biocom_tiktok_web_pixel`을 연다.
2. Overview 또는 Events activity에서 `2026-05-04 12:54:25 KST` 전후 서버 `Purchase`가 보이는지 확인한다.
3. 상세에 `event_id=Purchase_o202605033af504ba376d9`가 있는지 본다.
4. Diagnostics 탭에서 event_id mismatch, duplicate, policy, parameter warning이 있는지 본다.
5. 보이는 화면을 캡처해서 공유한다. token이나 access code는 공유하지 않는다.

성공 기준:
- server `Purchase` 1건이 보인다.
- `event_id=Purchase_o202605033af504ba376d9`가 보인다.
- Diagnostics에 심각 오류가 없다.
- Test Events가 아니라 production activity 쪽에서 확인된다.

실패 시 해석:
- 이벤트가 안 보이면 UI 반영 지연 또는 production endpoint 표시 지연 가능성이 있다. 10-30분 뒤 재확인한다.
- event_id mismatch가 있으면 production 확대는 중단한다.
- duplicate 경고가 있으면 dedup timing 또는 browser/server event_id 정책을 다시 본다.

### 2. Codex가 할 일

추천 점수: 80%

무엇을 하는가:
- TJ님 UI 확인 결과를 받으면 이 결과 문서를 `PASS` 또는 `FAIL_BLOCKED`로 업데이트한다.

왜 하는가:
- 현재는 API 기준 성공이지만 UI/Diagnostics 확인이 남아 있어 `PASS_WITH_NOTES`가 맞다.

어떻게 하는가:
1. TJ님 캡처를 기준으로 event_id와 Diagnostics를 문서에 추가한다.
2. 이상 없으면 canary 최종 verdict를 `PASS`로 올린다.
3. 이상 있으면 `FAIL_BLOCKED`로 두고 production 확대를 중단한다.
4. audit 후 commit/push한다.

승인 필요:
- 문서 업데이트는 Green Lane이라 추가 승인 불필요.
- 추가 production send는 Red Lane이라 별도 승인 필요.

## 다음 단계 판단

1건 canary 자체:
- 현재 자신감 72%
- API 기준 성공, UI/Diagnostics 확인 전이라 `PASS_WITH_NOTES`

전체 운영 전송:
- 현재 자신감 35%
- 아직 승인하면 안 된다.

확대 전 필요한 것:
- production canary UI/Diagnostics PASS
- 24시간 후 TikTok Ads 구매 수 중복 증가 없음 확인
- A/B/C 후보 정책 분리
- pending 가상계좌 입금 확정 케이스 별도 룰
- dispatcher kill switch와 max-send cap 설계

## Auditor verdict

Auditor verdict: PASS_WITH_NOTES

승인된 production canary 1건은 API 기준 성공했다. 금지 범위는 지켰다.

남은 note는 TikTok Events Manager Overview/Diagnostics 확인이다. 이 확인 전에는 production Events API 확대를 승인하면 안 된다.
