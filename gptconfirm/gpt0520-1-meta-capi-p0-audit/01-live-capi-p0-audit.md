harness_preflight:
  common_harness_read:
    - harness/common/HARNESS_GUIDELINES.md
    - harness/common/AUTONOMY_POLICY.md
    - harness/common/REPORTING_TEMPLATE.md
  project_harness_read:
    - AGENTS.md
    - data/!data_inventory.md
  lane: Green
  allowed_actions:
    - read_only_live_api_audit
    - aggregate_report
  forbidden_actions:
    - meta_send_or_backfill
    - production_db_write
    - raw_identifier_output
  source_window_freshness_confidence:
    site: biocom,thecleancoffee
    source: att.ainativeos.net live APIs
    freshness: 2026-05-20 18:24 KST latest ledger row observed
    confidence: high

# Live CAPI P0 Audit

## Source Separation

- `funnel-health`: VM Cloud 원장 기준 결제완료, CAPI 성공, action queue를 보는 화면/API.
- `capi log`: Meta CAPI 전송 시도/성공 로그. `events_received=1`이면 Meta가 서버 이벤트를 받은 것이다.
- rolling 24h와 KST calendar day는 숫자가 다를 수 있다. 이 보고서의 P0 판단은 rolling 24h를 primary로 둔다.

## Biocom

### Rolling 24h

- confirmed purchase: 49건 / 12,222,606원.
- Meta CAPI success: 47건.
- current missing: 2건 / 691,400원.
- current missing policy: `current_missing_watch`.

### 7d

- confirmed purchase: 366건 / 107,713,690원.
- Meta CAPI success: 350건.
- missing queue: 16건 / 4,045,885원.
- legacy do-not-backfill: 14건 / 3,354,485원.
- current missing watch: 2건 / 691,400원.

### KST today CAPI log cross-check

- success: 28건.
- failure: 0건.
- duplicate event_id: 0건.
- duplicate order event key: 0건.

## TheCleanCoffee

### Rolling 24h

- confirmed purchase: 18건 / 1,018,788원.
- Meta CAPI success: 18건.
- missing queue: 0건.

### 7d

- confirmed purchase: 181건 / 11,821,413원.
- Meta CAPI success: 183건.
- missing queue: 0건.

TheCleanCoffee 7d에서 CAPI success가 confirmed보다 2건 많은 것은 window/order timing 또는 send-log 기준 차이로 보인다. 현재 P0 위험은 아니다.

## Current Interpretation

바이오컴 P0는 정상에 가깝지만 100% green은 아니다. current missing 2건은 오늘 이후 자동 전송 품질을 보는 데 중요한 잔여 케이스다.
