# Missing queue action

## Scope

- Site: biocom
- Pixel: `1283400029487161`
- Window: 2026-05-15 KST
- Source: VM Cloud `attribution_ledger` + VM Cloud `meta-capi-sends.jsonl`
- Query time: 2026-05-16 00:13 KST
- Action mode: read-only classification only

## Current strict missing queue

Confirmed purchase rows without a matching successful Meta CAPI Purchase log:

- Total: 4건 / 791,000원
- `backfill_ready`: 4건 / 791,000원
- `legacy_missing_payment_key`: 0건 / 0원
- `duplicate_or_already_sent`: 0건 / 0원
- `no_send_guard`: 0건 / 0원

No backfill was sent in this sprint.

## Why this queue is smaller than the previous 15

The previous queue was before later CAPI auto-sync and additional log reconciliation. Current read-only snapshot shows most confirmed rows now have successful CAPI logs.

This is a good sign for the server path: the confirmed CAPI pipeline is catching up.

## Red approval candidate

If TJ님 wants to close the remaining same-day gap, the narrow approval can be:

```text
[승인] gpt0515-25 backfill_ready 4건만 Meta CAPI Purchase backfill 전송.
조건:
- site=biocom
- pixel=1283400029487161
- 2026-05-15 KST confirmed purchase
- backfill_ready 4건 / 791,000원만
- duplicate event_id 0
- canceled/refunded/0원/unknown 제외
- 다른 row send 0
- raw id 출력 금지
```

## Recommendation

Do not send immediately if the goal is only Ads Manager attribution diagnosis. The larger issue is that 22 strong Meta CAPI rows already reached Meta but Ads Manager purchase is still 0 for the date.

Backfilling the 4 rows can improve completeness, but it will not by itself explain why Ads Manager has not attributed the already-sent strong rows.

Recommendation score: 72%.
