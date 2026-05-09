# Path B identity-first hash-only storage canary approval

작성 시각: 2026-05-09 19:21 KST
요청 유형: Yellow Lane approval packet
Status: READY_FOR_TJ_DECISION

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - docurule.md
    - docs/report/text-report-template.md
  lane: Yellow approval packet
  allowed_actions:
    - approval packet writing
    - monitoring and rollback design
    - status taxonomy definition
  forbidden_actions:
    - canary execution without explicit approval
    - GTM Production publish without explicit approval
    - platform send
    - conversion upload
    - raw storage or logging
  source_window_freshness_confidence:
    source: gpt0508-15 browser row and local fixture tests
    window: 2026-05-09 19:05-19:21 KST
    freshness: same-session
    site: biocom
    confidence: high
```

## 한 줄 결론

다음 승인 후보는 1시간 identity-first hash-only storage canary다. 이 canary는 주문완료 화면에서 order/email/phone/session/click 후보를 hash-only로 저장하고, click이 없으면 `identity_only_quarantine`으로 격리한다.

## 무엇을 승인하는가

1시간 동안 주문완료 화면 only로 Path B order bridge row를 저장한다.

- site: `biocom`
- duration: 1h
- row cap: 200
- trigger scope: order complete pages only
- write mode: hash-only
- send_candidate: false
- platform send: 0
- raw storage/logging: 0

## 왜 필요한가

Preview/manual row는 기능 확인에는 충분하지만 실제 fill rate를 보여주지 않는다.

운영 판단에 필요한 것은 아래 분포다.

- `full_bridge`가 얼마나 생기는가.
- `identity_only_quarantine`이 얼마나 생기는가.
- `session_only_quarantine`이 얼마나 생기는가.
- click id가 없는 주문완료 row가 어느 정도인가.
- raw 저장과 platform send가 정말 0인가.

## 허용 범위

- VM Cloud write flag 1시간 임시 ON.
- GTM order-complete-only limited Production publish 또는 Preview/manual canary 중 승인된 방식 1개.
- hash-only row 저장.
- status taxonomy 저장.
- 10분 단위 monitoring.
- canary 종료 후 write flag OFF.

## 금지 범위

- All Pages trigger.
- GTM tag pause/delete of existing live tags.
- raw email/phone/member_code/order/payment 저장 또는 logging.
- Google Ads/GA4/Meta/TikTok/Naver 전송.
- Google Ads conversion upload.
- `send_candidate=true`.
- NPay click/count를 purchase로 승격.

## 저장 조건

저장 기본 조건:

- `order_no_hash` present.
- 그리고 아래 중 하나 이상:
  - `email_hash` present.
  - `phone_hash` present.
  - `client_id` / `ga_session_id` / `local_session_id_hash` present.

click id:

- `click_id_hash`는 optional이다.
- 있으면 `full_bridge` 가능성이 올라간다.
- 없으면 FAIL이 아니라 quarantine/HOLD다.

## Status 분류

| status | canary에서의 의미 | send_candidate |
|---|---|---|
| `full_bridge` | click까지 포함된 강한 후보 | false |
| `identity_only_quarantine` | identity는 있으나 click 없음 | false |
| `session_only_quarantine` | session 중심 후보 | false |
| `click_missing_hold` | click 없음 + 추가 key 부족 | false |
| `ambiguous` | 중복/다중 후보 위험 | false |
| `do_not_send` | 전송 금지 | false |

## Monitoring

10분마다 확인:

- row_count.
- status 분포.
- unique_order_no_hash.
- unique_email_hash.
- unique_phone_hash.
- unique_click_id_hash.
- identity hash fill rate.
- click hash fill rate.
- duplicate_dedupe_count.
- raw_stored_count.
- platform_send_count.
- endpoint 5xx.
- PM2 unexpected restart.

## Success criteria

PASS:

- row_count > 0.
- row_count <= 200.
- raw_stored_count = 0.
- platform_send_count = 0.
- endpoint 5xx < 1%.
- PM2 unexpected restart = 0.
- status 분포 산출 가능.
- write flag OFF cleanup verified.

HOLD:

- raw/platform 문제는 없지만 row_count=0.
- identity fill rate가 너무 낮음.
- click fill rate가 너무 낮음.
- NPay thanks page 복귀가 부족함.

FAIL:

- raw stored > 0.
- platform send > 0.
- row cap 초과.
- 5xx 반복.
- unexpected PM2 restart.
- All Pages trigger 확인.

## Rollback

즉시 중단 조건이 나오면 아래 상태로 되돌린다.

```text
ORDER_BRIDGE_WRITE_ENABLED=false
ORDER_BRIDGE_WRITE_CANARY_UNTIL=
ORDER_BRIDGE_WRITE_MAX_ROWS=200
ORDER_BRIDGE_PLATFORM_SEND_ENABLED=false
ORDER_BRIDGE_RAW_BODY_LOGGING=false
```

GTM Production publish를 승인한 mode라면:

- canary tag pause 또는 version rollback.
- order-complete-only trigger 외 확장 금지.

## 승인 문구 후보

```text
YES: Path B identity-first hash-only 1h storage canary를 승인합니다.
범위: biocom, 1시간, max 200 rows, order-complete-only, hash-only, send_candidate=false.
click_id_hash 없는 row는 identity_only_quarantine으로 저장하되 전송 후보에서 제외합니다.
금지: All Pages trigger, raw 저장/로그, GTM 기존 태그 pause/delete, Google Ads/GA4/Meta/TikTok/Naver 전송, conversion upload.
```

Auditor verdict: NEEDS_TJ_APPROVAL_FOR_1H_CANARY
