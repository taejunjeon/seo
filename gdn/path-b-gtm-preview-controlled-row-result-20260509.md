# Path B GTM Preview controlled browser row result

작성 시각: 2026-05-09 19:08 KST
Status: PASS_GTM_PREVIEW_CONTROLLED_BROWSER_ROW_STORED__CLICK_ID_HOLD

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
  lane: Yellow approved controlled Preview
  allowed_actions:
    - short VM Cloud write window
    - logged-in GTM Preview controlled traffic
    - one browser row
    - immediate write flag OFF cleanup
  forbidden_actions:
    - GTM Production publish
    - GTM submit/create_version
    - Imweb production save
    - 1h storage canary main run
    - platform send
    - conversion upload
    - raw operational storage or logging
  source_window_freshness_confidence:
    source: Tag Assistant evidence, VM Cloud summary endpoint, VM Cloud SQLite hash-prefix query
    window: 2026-05-09 19:04-19:08 KST
    freshness: same-session
    site: biocom
    confidence: high
```

## 한 줄 결론

TJ님 로그인 브라우저에서 GTM Preview tag가 실제 주문완료 화면에서 VM Cloud row 1건을 만들었다. 다만 이번 URL에는 TEST click id가 없어서 `click_id_hash_present=false`다.

## 확인된 것

- GTM event: `agent_os_path_b_controlled_traffic_result`.
- tag: `AGENT_OS_path_b_controlled_traffic_hmac_write_preview_20260509T095144Z`.
- response status: 200.
- `would_store`: true.
- `would_send`: false.
- `ledger_stored`: true.
- `ledger_deduped`: false.
- `email_hash_present`: true.
- `order_no_hash_present`: true.
- `client_session_present`: true.
- `click_id_hash_present`: false.
- `no_raw_echo_verified`: true.
- `no_platform_send_verified`: true.
- `platform_send_count`: 0.

## VM Cloud summary after cleanup

```json
{
  "row_count": 2,
  "unique_order_no_hash": 2,
  "unique_email_hash": 2,
  "unique_phone_hash": 1,
  "unique_click_id_hash": 1,
  "raw_stored_count": 0,
  "platform_send_count": 0,
  "duplicate_dedupe_count": 1,
  "write_flag_on": false,
  "write_max_rows": 200
}
```

## Latest row, hash prefix only

| field | value |
|---|---|
| capture_stage | `order_confirm_agent_os_controlled_traffic` |
| order_hash_present | PASS |
| email_hash_present | PASS |
| phone_hash_present | HOLD, not present in this row |
| click_id_hash_present | HOLD, not present in this row |
| client_id_present | PASS |
| ga_session_id_present | PASS |
| local_session_id_hash_present | PASS |
| identity_source | `email` |
| raw_payload_stored | 0 |
| platform_send_count | 0 |

## 해석

Path B의 실제 로그인 브라우저 저장 경로는 PASS다.

이번 결과가 말하는 것:

- 주문완료 화면의 기존 email-like user id를 transient email source로 받아 HMAC 처리할 수 있다.
- 주문번호는 raw 저장 없이 hash로 저장된다.
- client/session bridge도 실제 브라우저에서 들어온다.
- VM Cloud는 저장 후 즉시 flag OFF로 돌아왔다.

이번 결과가 아직 말하지 않는 것:

- 광고 클릭 id가 실제 주문완료 저장 row에 붙는지는 아직 확인되지 않았다.
- 실제 고객 트래픽 기준 fill rate는 아직 모른다.
- Google Ads/GA4/Meta/TikTok/Naver 전송 가능 여부는 판단하지 않는다.

## 다음 판단

1. 같은 workspace 165에서 TEST click id를 붙인 주문완료 URL로 한 번 더 controlled row를 만들면 `click_id_hash_present=true`를 확인할 수 있다.
2. 또는 1h canary main run 승인 전, 현재 결과를 `browser storage path PASS / click bridge HOLD`로 두고 canary approval packet을 보강한다.

Auditor verdict: PASS_WITH_CLICK_ID_HOLD
