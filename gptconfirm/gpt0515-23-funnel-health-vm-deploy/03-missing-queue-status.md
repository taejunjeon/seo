# 03. Missing Queue Status

## Source / Window / Freshness

- source: VM Cloud live funnel-health API + VM Cloud read-only SQLite/CAPI log cross-check
- window: last_7d
- checked_at_kst: 2026-05-15 19:05
- raw identifier output: 0

## Live API Queue

Live API:
- `site=biocom`: 14건 / 3,354,485원
- `site=thecleancoffee`: 1건 / 106,809원
- `site=all_sites`: 15건 / 3,461,294원

주의: `site=biocom` live API는 site evidence가 없는 row를 보수적으로 포함한다. 그래서 strict triage보다 크게 보일 수 있다.

## Strict Site Triage

Strict site classifier 기준:

```json
{
  "biocom": {
    "queue_count": 12,
    "queue_amount_krw": 2385485,
    "backfill_ready": {
      "count": 4,
      "amount_krw": 791000
    },
    "legacy_missing_payment_key": {
      "count": 8,
      "amount_krw": 1594485
    }
  },
  "thecleancoffee": {
    "queue_count": 2,
    "queue_amount_krw": 165031,
    "backfill_ready": {
      "count": 2,
      "amount_krw": 165031
    }
  }
}
```

## Interpretation

`backfill_ready` means confirmed + positive value + payment key present + no CAPI success match. This is still Red Lane if actual Meta send is needed.

`legacy_missing_payment_key` means confirmed revenue exists but CAPI event id/payment key safety is insufficient. It should not be sent until Toss/Imweb/legacy key mapping is strengthened.

## No-send Confirmation

This sprint did not send or backfill any Meta Purchase events.
