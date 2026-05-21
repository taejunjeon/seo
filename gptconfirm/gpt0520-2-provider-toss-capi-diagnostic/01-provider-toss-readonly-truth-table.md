# Provider/Toss Read-Only Truth Table

## Scope

- site: biocom
- pixel: 1283400029487161
- window: rolling 24h
- source: VM Cloud attribution ledger + Meta CAPI send log + Toss provider read-only API
- generated_at: 2026-05-20T13:39:57Z

## Safe Missing Candidates

| safe_ref | CAPI log status | Toss provider bucket | method bucket | amount match | approved_at present | interpretation |
|---|---|---|---|---|---|---|
| safe_c91fae5453 | no success log yet | done_or_paid | card | true | true | latest actual paid row; check next auto-sync cycle or single-row dry-run |
| safe_aaf855fa9f | no success log | canceled_or_refunded | card | true | true | no-send; should not appear as backfill-ready |
| safe_99b305804e | no success log | canceled_or_refunded | card | true | true | no-send; should not appear as backfill-ready |

## 결론

기존 2건은 “CAPI 누락”으로 다루면 안 된다. 결제사 기준 취소/환불이므로 Meta Purchase로 보내면 ROAS가 오염된다.

최신 1건은 결제사 기준 정상 결제완료다. 이 row가 다음 auto-sync cycle 뒤에도 CAPI success log로 들어오지 않으면, sync timing/visibility 또는 send-path bug로 분류한다.

## Safety

- raw identifier output: false
- provider response body output: false
- Meta send count: 0
- VM write count: 0
- production DB write count: 0
