# Meta EMQ no-send payload preview 결과

```yaml
harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - data/!data_inventory.md
  required_context_docs:
    - gptconfirm/gpt0520-5-emq-no-send-audit/00-result-report.md
  lane: Green
  allowed_actions:
    - VM Cloud SQLite read-only query
    - CAPI send log read-only summary
    - no-send payload shape preview
    - local report/script writing
  forbidden_actions:
    - Meta send/backfill
    - VM Cloud deploy/restart
    - GTM publish
    - Imweb save
    - 운영DB write/import
    - raw identifier output
  source_window_freshness_confidence:
    source: VM Cloud SQLite + VM CAPI send log + local backend source
    generated_at_utc: 2026-05-20T16:09:50Z
    generated_at_kst: 2026-05-21 01:09 KST
    windows: recent_24h, recent_7d
    confidence: high_for_payload_presence_preview
```

## 이번에 가능해진 것

Meta로 실제 전송하지 않고, Purchase CAPI payload에 추가할 수 있는 고객 매칭 필드 후보를 확인했다.

결론은 명확하다.

- 현재 payload에는 `em`, `ph`, `external_id`가 0이다.
- Imweb 주문 캐시를 조인하면 `ph`와 `external_id` 후보가 최근 7일 두 사이트 모두 confirmed 후보 100%에서 붙는다.
- CAPI success/failed 자체는 정상이다. 문제는 send 성공이 아니라 matching field 부족이다.

## preview 결과

| site | window | confirmed 후보 | CAPI success | 현재 fbp | 현재 fbc | 현재 em/ph/external_id | preview ph 후보 | preview external_id 후보 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| biocom | 24h | 42 | 41 | 41 | 19 | 0 / 0 / 0 | 42 | 42 |
| thecleancoffee | 24h | 15 | 15 | 15 | 5 | 0 / 0 / 0 | 15 | 15 |
| biocom | 7d | 369 | 353 | 363 | 171 | 0 / 0 / 0 | 369 | 369 |
| thecleancoffee | 7d | 173 | 172 | 173 | 41 | 0 / 0 / 0 | 173 | 173 |

## 안전한 preview payload shape

```json
{
  "event_name": "Purchase",
  "user_data": {
    "client_ip_address": "present_or_absent",
    "client_user_agent": "present_or_absent",
    "fbp": "present_or_absent",
    "fbc": "present_or_absent",
    "ph": "sha256_normalized_phone_if_approved",
    "external_id": "hmac_sha256_site_member_code_if_approved"
  },
  "custom_data": {
    "currency": "KRW",
    "value": "positive_confirmed_order_total",
    "order_id": "already_sent_order_key"
  }
}
```

실제 해시값, 원문 전화번호, 원문 회원 ID, 주문/결제 ID는 출력하지 않았다.

## 배포 의견

바로 전체 배포보다 2단계가 맞다.

1. 먼저 `ph` + `external_id`를 payload builder에 추가하되, env flag 기본값은 OFF로 둔다.
2. biocom만 짧은 window로 ON 해서 Event Match Quality와 send failure/duplicate를 확인한다.
3. 24~72시간 관찰 후 thecleancoffee까지 확장한다.

추천 이유:

- 후보율은 100%라 효과 기대는 높다.
- 하지만 고객 정보를 해시해서 Meta에 추가 전송하는 변경이므로 Red 성격이다.
- CAPI send는 이미 정상이라, 급하게 전체 ON을 할 필요는 없다.

## 하지 않은 것

- Meta 운영 Purchase send 0.
- 외부 플랫폼으로 `ph`/`external_id` 추가 전송 0.
- VM Cloud deploy/restart 0.
- GTM publish 0.
- 운영DB write/import 0.
- raw identifier output 0.
